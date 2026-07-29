import { TRPCError } from "@trpc/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  rateLimited,
} from "@/server/api/trpc";
import {
  documentContentSchema,
  documentFormatSchema,
  documentKindSchema,
  roleProfileSchema,
  shortTextSchema,
  uuidSchema,
} from "@/server/api/schemas";
import {
  activityLog,
  branches,
  documentVersions,
  watchTerms,
} from "@/server/db/schema";
import { analyzeHealth } from "@/lib/analysis/health";
import { sha256 } from "@/lib/utils";
import { logger } from "@/server/lib/logger";

/**
 * Documents are version-controlled like source code:
 *
 * - A **branch** is a mutable working copy. Exactly one per kind is `master`.
 * - A **version** is an immutable commit. Once written it is never mutated,
 *   because applications reference the exact bytes that were submitted.
 *
 * Master is protected by default so that tailoring for one company can never
 * quietly degrade the canonical resume.
 */

async function loadBranch(
  db: typeof import("@/server/db").db,
  userId: string,
  branchId: string,
) {
  const branch = await db.query.branches.findFirst({
    where: and(eq(branches.id, branchId), eq(branches.userId, userId)),
  });
  if (!branch) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Branch not found." });
  }
  return branch;
}

export const documentsRouter = createTRPCRouter({
  // -------------------------------------------------------------------------
  // Branches
  // -------------------------------------------------------------------------

  listBranches: protectedProcedure
    .input(z.object({ kind: documentKindSchema.default("resume") }).optional())
    .query(async ({ ctx, input }) => {
      const kind = input?.kind ?? "resume";
      return ctx.db.query.branches.findMany({
        where: and(
          eq(branches.userId, ctx.user.id),
          eq(branches.kind, kind),
          eq(branches.isArchived, false),
        ),
        orderBy: [desc(branches.isMaster), desc(branches.updatedAt)],
      });
    }),

  getBranch: protectedProcedure
    .input(z.object({ id: uuidSchema }))
    .query(({ ctx, input }) => loadBranch(ctx.db, ctx.user.id, input.id)),

  /**
   * Returns the user's workspace for a document kind, creating the master
   * branch on first use so the editor is never empty-stated by a missing row.
   */
  workspace: protectedProcedure
    .input(z.object({ kind: documentKindSchema.default("resume") }).optional())
    .query(async ({ ctx, input }) => {
      const kind = input?.kind ?? "resume";

      let all = await ctx.db.query.branches.findMany({
        where: and(eq(branches.userId, ctx.user.id), eq(branches.kind, kind)),
        orderBy: [desc(branches.isMaster), desc(branches.updatedAt)],
      });

      if (all.length === 0) {
        const [master] = await ctx.db
          .insert(branches)
          .values({
            userId: ctx.user.id,
            kind,
            name: kind === "resume" ? "Master Resume" : "Master Cover Letter",
            isMaster: true,
            profile: "general",
            content: "",
          })
          .returning();
        all = master ? [master] : [];
      }

      const terms = await ctx.db.query.watchTerms.findMany({
        where: eq(watchTerms.userId, ctx.user.id),
      });

      return {
        branches: all.filter((b) => !b.isArchived),
        master: all.find((b) => b.isMaster) ?? null,
        watchlist: terms.map((t) => t.term),
      };
    }),

  createBranch: protectedProcedure
    .use(rateLimited("mutation"))
    .input(
      z.object({
        kind: documentKindSchema.default("resume"),
        format: documentFormatSchema.default("latex"),
        name: shortTextSchema.optional(),
        company: shortTextSchema.optional(),
        role: shortTextSchema.optional(),
        profile: roleProfileSchema.default("general"),
        /** Branch to copy content from. Defaults to master. */
        fromBranchId: uuidSchema.optional(),
        content: documentContentSchema.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const source = input.fromBranchId
        ? await loadBranch(ctx.db, ctx.user.id, input.fromBranchId)
        : await ctx.db.query.branches.findFirst({
            where: and(
              eq(branches.userId, ctx.user.id),
              eq(branches.kind, input.kind),
              eq(branches.isMaster, true),
            ),
          });

      const content = input.content ?? source?.content ?? "";
      const name =
        input.name?.trim() ||
        [input.company, input.role].filter(Boolean).join(" · ") ||
        `${input.profile} branch`;

      const [created] = await ctx.db
        .insert(branches)
        .values({
          userId: ctx.user.id,
          kind: input.kind,
          format: input.format,
          name,
          company: input.company || null,
          role: input.role || null,
          profile: input.profile,
          isMaster: false,
          parentBranchId: source?.id ?? null,
          parentVersionId: source?.lastVersionId ?? null,
          content,
          contentHash: content ? await sha256(content) : null,
        })
        .returning();

      if (!created) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not create branch." });
      }

      await ctx.db.insert(activityLog).values({
        userId: ctx.user.id,
        kind: "branch",
        label: `Created branch “${created.name}”`,
        entityId: created.id,
        entityType: "branch",
      });

      return created;
    }),

  updateBranch: protectedProcedure
    .use(rateLimited("mutation"))
    .input(
      z.object({
        id: uuidSchema,
        name: shortTextSchema.optional(),
        company: shortTextSchema.nullish(),
        role: shortTextSchema.nullish(),
        profile: roleProfileSchema.optional(),
        isArchived: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const branch = await loadBranch(ctx.db, ctx.user.id, input.id);
      const { id, ...patch } = input;

      if (branch.isMaster && patch.isArchived) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "The master branch cannot be archived.",
        });
      }

      const [updated] = await ctx.db
        .update(branches)
        .set({
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.company !== undefined ? { company: patch.company || null } : {}),
          ...(patch.role !== undefined ? { role: patch.role || null } : {}),
          ...(patch.profile !== undefined ? { profile: patch.profile } : {}),
          ...(patch.isArchived !== undefined ? { isArchived: patch.isArchived } : {}),
        })
        .where(and(eq(branches.id, id), eq(branches.userId, ctx.user.id)))
        .returning();

      return updated!;
    }),

  /**
   * Persists in-progress editor content. Called on a debounce, so it is
   * deliberately cheap: no version row, no activity entry.
   */
  saveDraft: protectedProcedure
    .input(z.object({ branchId: uuidSchema, content: documentContentSchema }))
    .mutation(async ({ ctx, input }) => {
      await loadBranch(ctx.db, ctx.user.id, input.branchId);
      const hash = await sha256(input.content);

      const [updated] = await ctx.db
        .update(branches)
        .set({ content: input.content, contentHash: hash })
        .where(
          and(eq(branches.id, input.branchId), eq(branches.userId, ctx.user.id)),
        )
        .returning({ id: branches.id, updatedAt: branches.updatedAt });

      return { savedAt: updated?.updatedAt ?? new Date(), contentHash: hash };
    }),

  deleteBranch: protectedProcedure
    .input(z.object({ id: uuidSchema }))
    .mutation(async ({ ctx, input }) => {
      const branch = await loadBranch(ctx.db, ctx.user.id, input.id);
      if (branch.isMaster) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "The master branch cannot be deleted.",
        });
      }
      await ctx.db
        .delete(branches)
        .where(and(eq(branches.id, input.id), eq(branches.userId, ctx.user.id)));
      return { id: input.id };
    }),

  // -------------------------------------------------------------------------
  // Versions
  // -------------------------------------------------------------------------

  listVersions: protectedProcedure
    .input(
      z
        .object({
          kind: documentKindSchema.optional(),
          branchId: uuidSchema.optional(),
          limit: z.number().int().min(1).max(200).default(100),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(documentVersions.userId, ctx.user.id)];
      if (input?.kind) conditions.push(eq(documentVersions.kind, input.kind));
      if (input?.branchId) conditions.push(eq(documentVersions.branchId, input.branchId));

      return ctx.db.query.documentVersions.findMany({
        where: and(...conditions),
        orderBy: [desc(documentVersions.createdAt)],
        limit: input?.limit ?? 100,
      });
    }),

  getVersion: protectedProcedure
    .input(z.object({ id: uuidSchema }))
    .query(async ({ ctx, input }) => {
      const version = await ctx.db.query.documentVersions.findFirst({
        where: and(
          eq(documentVersions.id, input.id),
          eq(documentVersions.userId, ctx.user.id),
        ),
      });
      if (!version) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Version not found." });
      }
      return version;
    }),

  /**
   * Commits the current branch content as an immutable version.
   *
   * Committing identical content twice is rejected rather than silently
   * creating a duplicate, which keeps the history meaningful.
   */
  commitVersion: protectedProcedure
    .use(rateLimited("mutation"))
    .input(
      z.object({
        branchId: uuidSchema,
        note: shortTextSchema.optional(),
        content: documentContentSchema.optional(),
        /** Allow an identical commit anyway (used by automated snapshots). */
        force: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const branch = await loadBranch(ctx.db, ctx.user.id, input.branchId);
      const content = input.content ?? branch.content;

      if (!content.trim()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "There is nothing to save — the document is empty.",
        });
      }

      const contentHash = await sha256(content);

      if (!input.force && branch.lastVersionId) {
        const previous = await ctx.db.query.documentVersions.findFirst({
          where: and(
            eq(documentVersions.id, branch.lastVersionId),
            eq(documentVersions.userId, ctx.user.id),
          ),
          columns: { contentHash: true, note: true },
        });
        if (previous?.contentHash === contentHash) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "No changes since the last saved version.",
          });
        }
      }

      const [{ count } = { count: 0 }] = await ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(documentVersions)
        .where(
          and(
            eq(documentVersions.userId, ctx.user.id),
            eq(documentVersions.branchId, branch.id),
          ),
        );

      const watch = await ctx.db.query.watchTerms.findMany({
        where: eq(watchTerms.userId, ctx.user.id),
        columns: { term: true },
      });
      const health = analyzeHealth(content, { watchlist: watch.map((w) => w.term) });

      const [version] = await ctx.db
        .insert(documentVersions)
        .values({
          userId: ctx.user.id,
          kind: branch.kind,
          format: branch.format,
          branchId: branch.id,
          branchName: branch.name,
          parentVersionId: branch.lastVersionId ?? null,
          revision: count + 1,
          note: input.note?.trim() || `${branch.name} v${count + 1}`,
          content,
          contentHash,
          profile: branch.profile,
          company: branch.company,
          role: branch.role,
          stats: {
            wordCount: health.wordCount,
            bulletCount: health.bulletCount,
            healthScore: health.score,
            quantifiedPct: health.quantifiedPct,
            actionVerbPct: health.actionVerbPct,
          },
        })
        .returning();

      if (!version) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not save version." });
      }

      await ctx.db
        .update(branches)
        .set({ content, contentHash, lastVersionId: version.id })
        .where(eq(branches.id, branch.id));

      await ctx.db.insert(activityLog).values({
        userId: ctx.user.id,
        kind: "version",
        label: `Saved ${branch.kind === "resume" ? "resume" : "cover letter"} version “${version.note}”`,
        entityId: version.id,
        entityType: "document_version",
        metadata: { healthScore: health.score, revision: version.revision },
      });

      return version;
    }),

  /** Copies a historical version back into a branch's working content. */
  restoreVersion: protectedProcedure
    .input(z.object({ versionId: uuidSchema, branchId: uuidSchema }))
    .mutation(async ({ ctx, input }) => {
      const [version, branch] = await Promise.all([
        ctx.db.query.documentVersions.findFirst({
          where: and(
            eq(documentVersions.id, input.versionId),
            eq(documentVersions.userId, ctx.user.id),
          ),
        }),
        loadBranch(ctx.db, ctx.user.id, input.branchId),
      ]);

      if (!version) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Version not found." });
      }

      await ctx.db
        .update(branches)
        .set({ content: version.content, contentHash: version.contentHash })
        .where(eq(branches.id, branch.id));

      return { branchId: branch.id, content: version.content };
    }),

  deleteVersion: protectedProcedure
    .input(z.object({ id: uuidSchema }))
    .mutation(async ({ ctx, input }) => {
      // Applications keep their own frozen copy of the content, so removing a
      // version never rewrites the record of what was actually submitted.
      const [deleted] = await ctx.db
        .delete(documentVersions)
        .where(
          and(
            eq(documentVersions.id, input.id),
            eq(documentVersions.userId, ctx.user.id),
          ),
        )
        .returning({ id: documentVersions.id, branchId: documentVersions.branchId });

      if (!deleted) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Version not found." });
      }

      if (deleted.branchId) {
        const latest = await ctx.db.query.documentVersions.findFirst({
          where: and(
            eq(documentVersions.branchId, deleted.branchId),
            eq(documentVersions.userId, ctx.user.id),
          ),
          orderBy: [desc(documentVersions.createdAt)],
          columns: { id: true },
        });
        await ctx.db
          .update(branches)
          .set({ lastVersionId: latest?.id ?? null })
          .where(eq(branches.id, deleted.branchId));
      }

      return { id: input.id };
    }),

  // -------------------------------------------------------------------------
  // Keyword guardrails
  // -------------------------------------------------------------------------

  listWatchTerms: protectedProcedure.query(({ ctx }) =>
    ctx.db.query.watchTerms.findMany({
      where: eq(watchTerms.userId, ctx.user.id),
      orderBy: [desc(watchTerms.createdAt)],
    }),
  ),

  addWatchTerm: protectedProcedure
    .input(z.object({ term: z.string().trim().min(1).max(80) }))
    .mutation(async ({ ctx, input }) => {
      const [created] = await ctx.db
        .insert(watchTerms)
        .values({ userId: ctx.user.id, term: input.term })
        .onConflictDoNothing()
        .returning();

      if (!created) {
        logger.debug({ term: input.term }, "watch term already present");
      }
      return created ?? null;
    }),

  removeWatchTerm: protectedProcedure
    .input(z.object({ term: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(watchTerms)
        .where(
          and(
            eq(watchTerms.userId, ctx.user.id),
            sql`lower(${watchTerms.term}) = lower(${input.term})`,
          ),
        );
      return { term: input.term };
    }),
});
