import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  rateLimited,
} from "@/server/api/trpc";
import {
  documentContentSchema,
  jobDescriptionSchema,
  optionalUrlSchema,
  shortTextSchema,
  uuidSchema,
} from "@/server/api/schemas";
import {
  applications,
  branches,
  documentVersions,
  savedJobDescriptions,
  watchTerms,
} from "@/server/db/schema";
import {
  analyzeHealth,
  analyzeJobMatch,
  detectSkills,
  extractRequirements,
  findMissingTerms,
  findUnusedStrengths,
} from "@/lib/analysis";
import { diff, toHunks } from "@/lib/diff";

/**
 * Deterministic analysis. Nothing here calls a model: the same document always
 * produces the same report, which is what makes the numbers trustworthy and
 * lets every endpoint be a cheap cacheable query.
 */

/** Diffing two large documents is quadratic in the worst case; bound the input. */
const MAX_DIFF_CHARS = 120_000;

type Db = typeof import("@/server/db").db;

const sourceSelector = z.object({
  /** Unsaved editor content. Wins over the stored copy when provided. */
  content: documentContentSchema.optional(),
  branchId: uuidSchema.optional(),
  versionId: uuidSchema.optional(),
});

type SourceSelector = z.infer<typeof sourceSelector>;

interface ResolvedSource {
  content: string;
  label: string;
  branchId: string | null;
  versionId: string | null;
}

/**
 * Resolves the document to analyse. Every lookup is filtered by `userId`, so a
 * borrowed branch or version id resolves to nothing rather than someone else's
 * resume.
 */
async function resolveSource(
  db: Db,
  userId: string,
  input: SourceSelector,
): Promise<ResolvedSource> {
  if (input.versionId) {
    const version = await db.query.documentVersions.findFirst({
      where: and(
        eq(documentVersions.id, input.versionId),
        eq(documentVersions.userId, userId),
      ),
      columns: { id: true, content: true, note: true, branchId: true },
    });
    if (!version) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Version not found." });
    }
    return {
      content: input.content ?? version.content,
      label: version.note || "Saved version",
      branchId: version.branchId,
      versionId: version.id,
    };
  }

  if (input.branchId) {
    const branch = await db.query.branches.findFirst({
      where: and(eq(branches.id, input.branchId), eq(branches.userId, userId)),
      columns: { id: true, name: true, content: true, lastVersionId: true },
    });
    if (!branch) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Branch not found." });
    }
    return {
      content: input.content ?? branch.content,
      label: branch.name,
      branchId: branch.id,
      versionId: branch.lastVersionId ?? null,
    };
  }

  if (input.content !== undefined) {
    return { content: input.content, label: "Editor", branchId: null, versionId: null };
  }

  const master = await db.query.branches.findFirst({
    where: and(
      eq(branches.userId, userId),
      eq(branches.kind, "resume"),
      eq(branches.isMaster, true),
    ),
    columns: { id: true, name: true, content: true, lastVersionId: true },
  });
  if (!master) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "There is no document to analyse yet.",
    });
  }
  return {
    content: master.content,
    label: master.name,
    branchId: master.id,
    versionId: master.lastVersionId ?? null,
  };
}

/** The user's keyword guardrails, in insertion order. */
async function loadWatchlist(db: Db, userId: string): Promise<string[]> {
  const terms = await db.query.watchTerms.findMany({
    where: eq(watchTerms.userId, userId),
    columns: { term: true },
    orderBy: [desc(watchTerms.createdAt)],
  });
  return terms.map((t) => t.term);
}

async function resolveDiffSide(
  db: Db,
  userId: string,
  side: "left" | "right",
  content: string | undefined,
  versionId: string | undefined,
): Promise<{ content: string; label: string }> {
  if (content !== undefined) {
    return { content, label: side === "left" ? "Before" : "After" };
  }
  if (!versionId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Provide either content or a version id for the ${side} side.`,
    });
  }
  const version = await db.query.documentVersions.findFirst({
    where: and(
      eq(documentVersions.id, versionId),
      eq(documentVersions.userId, userId),
    ),
    columns: { content: true, note: true, revision: true },
  });
  if (!version) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Version not found." });
  }
  return { content: version.content, label: version.note || `v${version.revision}` };
}

export const analysisRouter = createTRPCRouter({
  // -------------------------------------------------------------------------
  // Document analysis
  // -------------------------------------------------------------------------

  health: protectedProcedure
    .input(sourceSelector.default({}))
    .query(async ({ ctx, input }) => {
      const [source, watchlist] = await Promise.all([
        resolveSource(ctx.db, ctx.user.id, input),
        loadWatchlist(ctx.db, ctx.user.id),
      ]);

      return {
        source: {
          label: source.label,
          branchId: source.branchId,
          versionId: source.versionId,
          chars: source.content.length,
        },
        ...analyzeHealth(source.content, { watchlist }),
      };
    }),

  jobMatch: protectedProcedure
    .input(
      sourceSelector.extend({
        jobDescription: jobDescriptionSchema,
        /** Falls back to this application's archived posting and submitted resume. */
        applicationId: uuidSchema.optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const application = input.applicationId
        ? await ctx.db.query.applications.findFirst({
            where: and(
              eq(applications.id, input.applicationId),
              eq(applications.userId, ctx.user.id),
            ),
            columns: {
              id: true,
              company: true,
              role: true,
              jobDescription: true,
              resumeSnapshot: true,
            },
          })
        : null;

      if (input.applicationId && !application) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Application not found.",
        });
      }

      const jobDescription =
        input.jobDescription.trim() || application?.jobDescription?.trim() || "";
      if (!jobDescription) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Paste the job description to match against.",
        });
      }

      const hasExplicitSource =
        input.content !== undefined || !!input.branchId || !!input.versionId;

      const source: ResolvedSource =
        !hasExplicitSource && application?.resumeSnapshot
          ? {
              content: application.resumeSnapshot,
              label: `${application.company} submission`,
              branchId: null,
              versionId: null,
            }
          : await resolveSource(ctx.db, ctx.user.id, input);

      const match = analyzeJobMatch(jobDescription, source.content);

      return {
        source: {
          label: source.label,
          branchId: source.branchId,
          versionId: source.versionId,
        },
        applicationId: application?.id ?? null,
        ...match,
        /** Resume skills the posting never mentions — candidates for trimming. */
        unusedStrengths: findUnusedStrengths(source.content, jobDescription),
      };
    }),

  diff: protectedProcedure
    .input(
      z.object({
        leftContent: documentContentSchema.optional(),
        leftVersionId: uuidSchema.optional(),
        rightContent: documentContentSchema.optional(),
        rightVersionId: uuidSchema.optional(),
        granularity: z.enum(["line", "word"]).default("line"),
      }),
    )
    .query(async ({ ctx, input }) => {
      const [left, right] = await Promise.all([
        resolveDiffSide(
          ctx.db,
          ctx.user.id,
          "left",
          input.leftContent,
          input.leftVersionId,
        ),
        resolveDiffSide(
          ctx.db,
          ctx.user.id,
          "right",
          input.rightContent,
          input.rightVersionId,
        ),
      ]);

      if (
        left.content.length > MAX_DIFF_CHARS ||
        right.content.length > MAX_DIFF_CHARS
      ) {
        throw new TRPCError({
          code: "PAYLOAD_TOO_LARGE",
          message: `Documents larger than ${MAX_DIFF_CHARS.toLocaleString()} characters cannot be compared.`,
        });
      }

      const result = diff(left.content, right.content, input.granularity);

      return {
        granularity: input.granularity,
        left: { label: left.label, chars: left.content.length },
        right: { label: right.label, chars: right.content.length },
        ops: result.ops,
        stats: result.stats,
        hunks: input.granularity === "line" ? toHunks(result.ops) : [],
      };
    }),

  watchlistStatus: protectedProcedure
    .input(
      z
        .object({
          content: documentContentSchema.optional(),
          branchId: uuidSchema.optional(),
        })
        .default({}),
    )
    .query(async ({ ctx, input }) => {
      const [source, watchlist] = await Promise.all([
        resolveSource(ctx.db, ctx.user.id, input),
        loadWatchlist(ctx.db, ctx.user.id),
      ]);

      const missing = new Set(findMissingTerms(source.content, watchlist));

      return {
        terms: watchlist.map((term) => ({ term, present: !missing.has(term) })),
        missing: watchlist.filter((term) => missing.has(term)),
        presentCount: watchlist.length - missing.size,
        total: watchlist.length,
      };
    }),

  detectedSkills: protectedProcedure
    .input(
      z
        .object({
          content: documentContentSchema.optional(),
          branchId: uuidSchema.optional(),
        })
        .default({}),
    )
    .query(async ({ ctx, input }) => {
      const [source, watchlist] = await Promise.all([
        resolveSource(ctx.db, ctx.user.id, input),
        loadWatchlist(ctx.db, ctx.user.id),
      ]);

      const skills = detectSkills(source.content);
      const watched = new Set(watchlist.map((t) => t.toLowerCase()));

      return {
        skills,
        /** Detected skills not yet guarded, offered as one-click guardrails. */
        suggested: skills.filter((s) => !watched.has(s.toLowerCase())),
      };
    }),

  // -------------------------------------------------------------------------
  // Saved postings
  // -------------------------------------------------------------------------

  listJds: protectedProcedure
    .input(
      z
        .object({ limit: z.number().int().min(1).max(100).default(50) })
        .optional(),
    )
    .query(({ ctx, input }) =>
      ctx.db.query.savedJobDescriptions.findMany({
        where: eq(savedJobDescriptions.userId, ctx.user.id),
        orderBy: [desc(savedJobDescriptions.createdAt)],
        limit: input?.limit ?? 50,
      }),
    ),

  saveJd: protectedProcedure
    .use(rateLimited("mutation"))
    .input(
      z.object({
        id: uuidSchema.optional(),
        title: shortTextSchema.optional(),
        company: shortTextSchema.optional(),
        sourceUrl: optionalUrlSchema,
        content: jobDescriptionSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!input.content.trim()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "There is nothing to save — the posting is empty.",
        });
      }

      const analysis = {
        analyzedAt: new Date().toISOString(),
        terms: extractRequirements(input.content, { limit: 40 }),
      };
      const values = {
        title: input.title?.trim() || "Untitled posting",
        company: input.company?.trim() || null,
        sourceUrl: input.sourceUrl?.trim() || null,
        content: input.content,
        analysis,
      };

      if (input.id) {
        const [updated] = await ctx.db
          .update(savedJobDescriptions)
          .set(values)
          .where(
            and(
              eq(savedJobDescriptions.id, input.id),
              eq(savedJobDescriptions.userId, ctx.user.id),
            ),
          )
          .returning();

        if (!updated) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Posting not found." });
        }
        return updated;
      }

      const [created] = await ctx.db
        .insert(savedJobDescriptions)
        .values({ userId: ctx.user.id, ...values })
        .returning();

      if (!created) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Could not save the posting.",
        });
      }
      return created;
    }),

  deleteJd: protectedProcedure
    .input(z.object({ id: uuidSchema }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.db
        .delete(savedJobDescriptions)
        .where(
          and(
            eq(savedJobDescriptions.id, input.id),
            eq(savedJobDescriptions.userId, ctx.user.id),
          ),
        )
        .returning({ id: savedJobDescriptions.id });

      if (!deleted) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Posting not found." });
      }
      return { id: deleted.id };
    }),
});
