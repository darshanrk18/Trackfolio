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
  texEngineSchema,
  uuidSchema,
} from "@/server/api/schemas";
import { branches, compilations, documentVersions } from "@/server/db/schema";
import { compileLatex } from "@/server/services/latex";

/**
 * Compilation endpoints. All three mutations funnel into the same cached
 * service, so compiling a branch and compiling the identical frozen version
 * share one upstream request.
 */

export const latexRouter = createTRPCRouter({
  compile: protectedProcedure
    .use(rateLimited("compile"))
    .input(
      z.object({
        source: documentContentSchema,
        engine: texEngineSchema.default("pdflatex"),
        force: z.boolean().default(false),
      }),
    )
    .mutation(({ ctx, input }) =>
      compileLatex({
        userId: ctx.user.id,
        source: input.source,
        engine: input.engine,
        force: input.force,
        db: ctx.db,
      }),
    ),

  compileBranch: protectedProcedure
    .use(rateLimited("compile"))
    .input(
      z.object({
        branchId: uuidSchema,
        engine: texEngineSchema.default("pdflatex"),
        force: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const branch = await ctx.db.query.branches.findFirst({
        where: and(
          eq(branches.id, input.branchId),
          eq(branches.userId, ctx.user.id),
        ),
        columns: { id: true, content: true },
      });

      if (!branch) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Branch not found." });
      }

      return compileLatex({
        userId: ctx.user.id,
        source: branch.content,
        engine: input.engine,
        force: input.force,
        db: ctx.db,
      });
    }),

  compileVersion: protectedProcedure
    .use(rateLimited("compile"))
    .input(
      z.object({
        versionId: uuidSchema,
        engine: texEngineSchema.default("pdflatex"),
        force: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const version = await ctx.db.query.documentVersions.findFirst({
        where: and(
          eq(documentVersions.id, input.versionId),
          eq(documentVersions.userId, ctx.user.id),
        ),
        columns: { id: true, content: true, pdfUrl: true, pdfBytes: true },
      });

      if (!version) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Version not found.",
        });
      }

      const result = await compileLatex({
        userId: ctx.user.id,
        source: version.content,
        engine: input.engine,
        force: input.force,
        db: ctx.db,
      });

      // Versions are immutable in their content; only the pointer to the
      // rendered artifact is written back, so a saved version can be
      // downloaded later without recompiling.
      if (
        result.status === "success" &&
        result.pdfUrl &&
        result.pdfUrl !== version.pdfUrl &&
        !result.pdfUrl.startsWith("data:")
      ) {
        await ctx.db
          .update(documentVersions)
          .set({ pdfUrl: result.pdfUrl, pdfBytes: result.bytes ?? null })
          .where(
            and(
              eq(documentVersions.id, version.id),
              eq(documentVersions.userId, ctx.user.id),
            ),
          );
      }

      return result;
    }),

  history: protectedProcedure
    .input(
      z
        .object({ limit: z.number().int().min(1).max(100).default(25) })
        .optional(),
    )
    .query(({ ctx, input }) =>
      ctx.db.query.compilations.findMany({
        where: eq(compilations.userId, ctx.user.id),
        orderBy: [desc(compilations.createdAt)],
        limit: input?.limit ?? 25,
        columns: {
          id: true,
          contentHash: true,
          engine: true,
          status: true,
          pdfUrl: true,
          bytes: true,
          durationMs: true,
          createdAt: true,
        },
      }),
    ),
});
