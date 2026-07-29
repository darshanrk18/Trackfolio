import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import {
  createTRPCRouter,
  profileProcedure,
  protectedProcedure,
  rateLimited,
} from "@/server/api/trpc";
import {
  emptyToNull,
  optionalUrlSchema,
  shortTextSchema,
  texEngineSchema,
} from "@/server/api/schemas";
import { activityLog, userProfiles, users } from "@/server/db/schema";
import { ensureProfile } from "@/server/auth";
import { logger } from "@/server/lib/logger";
import { purgeUserContent } from "@/server/services/purge";

/**
 * Account and preferences.
 *
 * Product settings live in `userProfiles` rather than the Auth.js `user` table,
 * so this router reads from both and presents them as one object.
 */

export const profileRouter = createTRPCRouter({
  /** The signed-in user's profile, created on first access. */
  get: protectedProcedure.query(async ({ ctx }) => {
    const profile = await ensureProfile(ctx.user.id);

    const account = await ctx.db.query.users.findFirst({
      where: eq(users.id, ctx.user.id),
      columns: {
        name: true,
        email: true,
        image: true,
        createdAt: true,
        emailVerified: true,
      },
    });

    if (!account) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Account not found." });
    }

    return {
      ...profile,
      name: account.name,
      email: account.email,
      image: account.image,
      emailVerified: account.emailVerified,
      memberSince: account.createdAt,
      onboarded: profile.onboardedAt !== null,
    };
  }),

  update: profileProcedure
    .use(rateLimited("mutation"))
    .input(
      z.object({
        fullName: shortTextSchema.nullish(),
        headline: shortTextSchema.nullish(),
        location: shortTextSchema.nullish(),
        phone: shortTextSchema.nullish(),
        websiteUrl: optionalUrlSchema,
        linkedinUrl: optionalUrlSchema,
        githubUrl: optionalUrlSchema,
        theme: z.enum(["light", "dark", "system"]).optional(),
        accent: z.string().trim().min(1).max(32).optional(),
        timezone: z.string().trim().min(1).max(64).optional(),
        staleAfterDays: z.number().int().min(1).max(120).optional(),
        defaultTexEngine: texEngineSchema.optional(),
        autoCompile: z.boolean().optional(),
        digestEnabled: z.boolean().optional(),
        digestDay: z.number().int().min(0).max(6).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const patch = {
        ...(input.fullName !== undefined ? { fullName: emptyToNull(input.fullName) } : {}),
        ...(input.headline !== undefined ? { headline: emptyToNull(input.headline) } : {}),
        ...(input.location !== undefined ? { location: emptyToNull(input.location) } : {}),
        ...(input.phone !== undefined ? { phone: emptyToNull(input.phone) } : {}),
        ...(input.websiteUrl !== undefined ? { websiteUrl: emptyToNull(input.websiteUrl) } : {}),
        ...(input.linkedinUrl !== undefined ? { linkedinUrl: emptyToNull(input.linkedinUrl) } : {}),
        ...(input.githubUrl !== undefined ? { githubUrl: emptyToNull(input.githubUrl) } : {}),
        ...(input.theme !== undefined ? { theme: input.theme } : {}),
        ...(input.accent !== undefined ? { accent: input.accent } : {}),
        ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
        ...(input.staleAfterDays !== undefined ? { staleAfterDays: input.staleAfterDays } : {}),
        ...(input.defaultTexEngine !== undefined ? { defaultTexEngine: input.defaultTexEngine } : {}),
        ...(input.autoCompile !== undefined ? { autoCompile: input.autoCompile } : {}),
        ...(input.digestEnabled !== undefined ? { digestEnabled: input.digestEnabled } : {}),
        ...(input.digestDay !== undefined ? { digestDay: input.digestDay } : {}),
      };

      if (Object.keys(patch).length === 0) return ctx.profile;

      const [updated] = await ctx.db
        .update(userProfiles)
        .set(patch)
        .where(eq(userProfiles.userId, ctx.user.id))
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Could not save your settings.",
        });
      }

      return updated;
    }),

  completeOnboarding: profileProcedure.mutation(async ({ ctx }) => {
    const [updated] = await ctx.db
      .update(userProfiles)
      .set({ onboardedAt: ctx.profile.onboardedAt ?? new Date() })
      .where(eq(userProfiles.userId, ctx.user.id))
      .returning({ onboardedAt: userProfiles.onboardedAt });

    await ctx.db.insert(activityLog).values({
      userId: ctx.user.id,
      kind: "auth",
      label: "Finished onboarding",
    });

    return { onboardedAt: updated?.onboardedAt ?? new Date() };
  }),

  /**
   * Closes the account. The `user` row is soft-deleted so audit trails and
   * uniqueness of the email survive, while every content row is removed for
   * real. Both happen in one transaction: a half-deleted account is worse than
   * none at all.
   */
  deleteAccount: protectedProcedure
    .use(rateLimited("mutation"))
    .input(z.object({ confirmation: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const account = await ctx.db.query.users.findFirst({
        where: eq(users.id, ctx.user.id),
        columns: { id: true, email: true },
      });

      if (!account) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Account not found." });
      }

      if (input.confirmation.trim() !== account.email) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Type your email address exactly to confirm deletion.",
        });
      }

      const tx = ctx.txClient();
      await tx.transaction(async (trx) => {
        await purgeUserContent(trx, ctx.user.id);

        // Identity fields are cleared rather than kept alongside a tombstone.
        await trx
          .update(userProfiles)
          .set({
            fullName: null,
            headline: null,
            location: null,
            phone: null,
            websiteUrl: null,
            linkedinUrl: null,
            githubUrl: null,
            encryptedAiKey: null,
          })
          .where(eq(userProfiles.userId, ctx.user.id));

        await trx
          .update(users)
          .set({ deletedAt: new Date() })
          .where(and(eq(users.id, ctx.user.id), eq(users.email, account.email)));
      });

      logger.warn({ userId: ctx.user.id }, "account deleted");

      return { deleted: true as const };
    }),
});
