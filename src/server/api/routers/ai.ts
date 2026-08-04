import { TRPCError } from "@trpc/server";
import { and, eq, gte, sql } from "drizzle-orm";
import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  rateLimited,
} from "@/server/api/trpc";
import {
  documentContentSchema,
  jobDescriptionSchema,
  mediumTextSchema,
  notesSchema,
  shortTextSchema,
} from "@/server/api/schemas";
import { aiRuns } from "@/server/db/schema";
import { isAiEnabled } from "@/server/ai/provider";
import {
  analyzeGaps,
  extractJobPosting,
  generateCoverLetter,
  generateInterviewQuestions,
  rewriteBullet,
  tailorResume,
} from "@/server/ai/tasks";

/**
 * Model-backed endpoints.
 *
 * Runs are not linked to an application here: the audit table accepts an
 * application id, but accepting one from the client would mean trusting a
 * foreign key we have not ownership-checked.
 */

/**
 * Model calls are metered and cost money, so the two guards are applied before
 * the procedure body: a deployment without keys fails fast, and a configured
 * one is bounded per user.
 */
const aiProcedure = protectedProcedure
  .use(async ({ next }) => {
    if (!isAiEnabled()) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message:
          "AI features are unavailable — no model provider is configured for this deployment.",
      });
    }
    return next();
  })
  .use(rateLimited("ai"));

/** Surfaces model/network failures as a transport error rather than a 500. */
async function run<T>(task: () => Promise<T>): Promise<T> {
  try {
    return await task();
  } catch (error) {
    if (error instanceof TRPCError) throw error;
    throw new TRPCError({
      code: "BAD_GATEWAY",
      message:
        error instanceof Error ? error.message : "The AI request failed.",
    });
  }
}

const bulletSchema = mediumTextSchema.min(1, "There is no bullet to rewrite.");

export const aiRouter = createTRPCRouter({
  /** Lets the UI hide AI affordances entirely when no provider is configured. */
  enabled: protectedProcedure.query(() => ({ enabled: isAiEnabled() })),

  usage: protectedProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const periodStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );

    const [totals] = await ctx.db
      .select({
        runs: sql<number>`count(*)::int`,
        costUsd: sql<number>`coalesce(sum(${aiRuns.costUsd}), 0)::float8`,
      })
      .from(aiRuns)
      .where(
        and(
          eq(aiRuns.userId, ctx.user.id),
          gte(aiRuns.createdAt, periodStart),
        ),
      );

    return {
      periodStart,
      runs: totals?.runs ?? 0,
      costUsd: totals?.costUsd ?? 0,
    };
  }),

  rewriteBullet: aiProcedure
    .input(
      z.object({
        bullet: bulletSchema,
        context: documentContentSchema.optional(),
        jobDescription: jobDescriptionSchema.optional(),
      }),
    )
    .mutation(({ ctx, input }) =>
      run(() =>
        rewriteBullet({
          db: ctx.db,
          userId: ctx.user.id,
          bullet: input.bullet,
          context: input.context,
          jobDescription: input.jobDescription,
        }),
      ),
    ),

  analyzeGaps: aiProcedure
    .input(
      z.object({
        resume: documentContentSchema,
        jobDescription: jobDescriptionSchema,
      }),
    )
    .mutation(({ ctx, input }) =>
      run(() =>
        analyzeGaps({
          db: ctx.db,
          userId: ctx.user.id,
          resume: input.resume,
          jobDescription: input.jobDescription,
        }),
      ),
    ),

  tailorResume: aiProcedure
    .input(
      z.object({
        resume: documentContentSchema,
        jobDescription: jobDescriptionSchema,
        company: shortTextSchema.optional(),
        role: shortTextSchema.optional(),
      }),
    )
    .mutation(({ ctx, input }) =>
      run(() =>
        tailorResume({
          db: ctx.db,
          userId: ctx.user.id,
          resume: input.resume,
          jobDescription: input.jobDescription,
          company: input.company,
          role: input.role,
        }),
      ),
    ),

  generateCoverLetter: aiProcedure
    .input(
      z.object({
        resume: documentContentSchema,
        jobDescription: jobDescriptionSchema,
        company: shortTextSchema.optional(),
        role: shortTextSchema.optional(),
        tone: z
          .enum(["professional", "warm", "direct", "enthusiastic"])
          .default("professional"),
        notes: notesSchema.optional(),
      }),
    )
    .mutation(({ ctx, input }) =>
      run(() =>
        generateCoverLetter({
          db: ctx.db,
          userId: ctx.user.id,
          resume: input.resume,
          jobDescription: input.jobDescription,
          company: input.company,
          role: input.role,
          tone: input.tone,
          notes: input.notes,
        }),
      ),
    ),

  generateInterviewQuestions: aiProcedure
    .input(
      z.object({
        resume: documentContentSchema,
        jobDescription: jobDescriptionSchema,
        company: shortTextSchema.optional(),
        role: shortTextSchema.optional(),
        count: z.number().int().min(3).max(25).default(10),
      }),
    )
    .mutation(({ ctx, input }) =>
      run(() =>
        generateInterviewQuestions({
          db: ctx.db,
          userId: ctx.user.id,
          resume: input.resume,
          jobDescription: input.jobDescription,
          company: input.company,
          role: input.role,
          count: input.count,
        }),
      ),
    ),

  extractJobPosting: aiProcedure
    .input(z.object({ text: jobDescriptionSchema }))
    .mutation(({ ctx, input }) =>
      run(() =>
        extractJobPosting({
          db: ctx.db,
          userId: ctx.user.id,
          text: input.text,
        }),
      ),
    ),
});
