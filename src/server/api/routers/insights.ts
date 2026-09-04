import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { uuidSchema } from "@/server/api/schemas";
import {
  activityLog,
  applications,
  branches,
  contacts,
  documentVersions,
  notifications,
  watchTerms,
} from "@/server/db/schema";
import { analyzeHealth } from "@/lib/analysis/health";
import { buildActionQueue } from "@/lib/insights/actions";
import { daysUntil } from "@/lib/utils";
import {
  conversionBy,
  strategyInsight,
  summarizeSearch,
} from "@/lib/insights/analytics";
import { FUNNEL_STAGES, profileLabel } from "@/lib/pipeline";
import { ensureProfile } from "@/server/auth";

export const insightsRouter = createTRPCRouter({
  /** Badge + HUD counts for the four-mode shell. Decorative; layout swallows errors. */
  shell: protectedProcedure.query(async ({ ctx }) => {
    const profile = await ensureProfile(ctx.user.id);
    const [apps, people, resumeVersions, coverVersions] = await Promise.all([
      ctx.db.query.applications.findMany({
        where: and(
          eq(applications.userId, ctx.user.id),
          isNull(applications.archivedAt),
        ),
        columns: {
          id: true,
          company: true,
          role: true,
          status: true,
          priority: true,
          appliedOn: true,
          followUpOn: true,
          interviewOn: true,
          updatedAt: true,
          jobDescription: true,
          resumeSnapshot: true,
          nextStep: true,
        },
      }),
      ctx.db.query.contacts.findMany({
        where: eq(contacts.userId, ctx.user.id),
        columns: {
          id: true,
          name: true,
          company: true,
          lastContactedOn: true,
          nextTouchOn: true,
          cadenceDays: true,
        },
      }),
      ctx.db
        .select({ n: sql<number>`count(*)::int` })
        .from(documentVersions)
        .where(
          and(
            eq(documentVersions.userId, ctx.user.id),
            eq(documentVersions.kind, "resume"),
          ),
        ),
      ctx.db
        .select({ n: sql<number>`count(*)::int` })
        .from(documentVersions)
        .where(
          and(
            eq(documentVersions.userId, ctx.user.id),
            eq(documentVersions.kind, "cover_letter"),
          ),
        ),
    ]);

    const queue = buildActionQueue({
      applications: apps,
      contacts: people,
      staleAfterDays: profile.staleAfterDays,
    });

    return {
      applications: apps.length,
      actions: queue.length,
      versions: resumeVersions[0]?.n ?? 0,
      coverLetters: coverVersions[0]?.n ?? 0,
      contacts: people.length,
      urgentActions: queue.filter((item) => item.kind === "urgent").length,
    };
  }),

  actionQueue: protectedProcedure.query(async ({ ctx }) => {
    const profile = await ensureProfile(ctx.user.id);
    const [apps, people] = await Promise.all([
      ctx.db.query.applications.findMany({
        where: and(
          eq(applications.userId, ctx.user.id),
          isNull(applications.archivedAt),
        ),
        columns: {
          id: true,
          company: true,
          role: true,
          status: true,
          priority: true,
          appliedOn: true,
          followUpOn: true,
          interviewOn: true,
          updatedAt: true,
          jobDescription: true,
          resumeSnapshot: true,
          nextStep: true,
        },
      }),
      ctx.db.query.contacts.findMany({
        where: eq(contacts.userId, ctx.user.id),
        columns: {
          id: true,
          name: true,
          company: true,
          lastContactedOn: true,
          nextTouchOn: true,
          cadenceDays: true,
        },
      }),
    ]);

    return buildActionQueue({
      applications: apps,
      contacts: people,
      staleAfterDays: profile.staleAfterDays,
    });
  }),

  dashboard: protectedProcedure.query(async ({ ctx }) => {
    const profile = await ensureProfile(ctx.user.id);

    const [apps, master, terms, activity, people] = await Promise.all([
      ctx.db.query.applications.findMany({
        where: and(
          eq(applications.userId, ctx.user.id),
          isNull(applications.archivedAt),
        ),
        columns: {
          id: true,
          company: true,
          role: true,
          status: true,
          priority: true,
          appliedOn: true,
          followUpOn: true,
          interviewOn: true,
          updatedAt: true,
          jobDescription: true,
          resumeSnapshot: true,
          nextStep: true,
          source: true,
          profile: true,
        },
      }),
      ctx.db.query.branches.findFirst({
        where: and(
          eq(branches.userId, ctx.user.id),
          eq(branches.kind, "resume"),
          eq(branches.isMaster, true),
        ),
        columns: { content: true },
      }),
      ctx.db.query.watchTerms.findMany({
        where: eq(watchTerms.userId, ctx.user.id),
        columns: { term: true },
      }),
      ctx.db.query.activityLog.findMany({
        where: eq(activityLog.userId, ctx.user.id),
        orderBy: [desc(activityLog.createdAt)],
        limit: 12,
      }),
      ctx.db.query.contacts.findMany({
        where: eq(contacts.userId, ctx.user.id),
        columns: {
          id: true,
          name: true,
          company: true,
          lastContactedOn: true,
          nextTouchOn: true,
          cadenceDays: true,
        },
      }),
    ]);

    const watchlist = terms.map((t) => t.term);
    const health = master?.content
      ? analyzeHealth(master.content, { watchlist })
      : null;

    const actions = buildActionQueue({
      applications: apps,
      contacts: people,
      staleAfterDays: profile.staleAfterDays,
    });

    const byStatus = Object.fromEntries(
      FUNNEL_STAGES.map((status) => [
        status,
        apps.filter((a) => a.status === status).length,
      ]),
    ) as Record<(typeof FUNNEL_STAGES)[number], number>;

    const appliedPlus = apps.filter((a) => a.status !== "wishlist").length;
    const interviews = apps.filter(
      (a) =>
        a.status === "interview" ||
        a.status === "final" ||
        a.status === "offer" ||
        a.status === "accepted",
    ).length;
    const offers = apps.filter(
      (a) => a.status === "offer" || a.status === "accepted",
    ).length;

    const upcoming = apps
      .filter((app) => {
        const until = daysUntil(app.interviewOn);
        return until !== null && until >= 0 && until <= 21;
      })
      .sort((a, b) => {
        const left = a.interviewOn ? new Date(a.interviewOn).getTime() : 0;
        const right = b.interviewOn ? new Date(b.interviewOn).getTime() : 0;
        return left - right;
      })
      .slice(0, 6)
      .map((app) => ({
        id: app.id,
        company: app.company,
        role: app.role,
        interviewOn: app.interviewOn,
        frozen: Boolean(app.resumeSnapshot),
      }));

    return {
      totals: {
        applications: apps.length,
        active: apps.filter((a) =>
          ["applied", "screen", "assessment", "interview", "final"].includes(
            a.status,
          ),
        ).length,
        interviews,
        offers,
        stale: actions.filter((a) => a.type === "stale").length,
        flaggedSnapshots: actions.filter((a) => a.type === "missing_snapshot")
          .length,
      },
      funnel: [
        { status: "applied" as const, count: appliedPlus, label: "Applied" },
        { status: "interview" as const, count: interviews, label: "Interview" },
        { status: "offer" as const, count: offers, label: "Offer" },
      ],
      smallSample: appliedPlus < 3,
      byStatus,
      health: health
        ? {
            score: health.score,
            grade: health.grade,
            wordCount: health.wordCount,
            bulletCount: health.bulletCount,
            issues: health.checks
              .filter((check) => check.state === "fail" || check.state === "warn")
              .map((check) => ({
                id: check.id,
                label: check.label,
                state: check.state as "fail" | "warn",
              })),
          }
        : null,
      actions: actions.slice(0, 8),
      actionCount: actions.length,
      upcoming,
      activity,
    };
  }),

  analytics: protectedProcedure.query(async ({ ctx }) => {
    const apps = await ctx.db.query.applications.findMany({
      where: and(
        eq(applications.userId, ctx.user.id),
        isNull(applications.archivedAt),
      ),
      columns: {
        status: true,
        source: true,
        profile: true,
      },
    });

    const summary = summarizeSearch(apps);
    const byProfile = conversionBy(apps, (a) => profileLabel(a.profile));
    const bySource = conversionBy(apps, (a) => a.source?.trim() || "Unknown");
    const insight = strategyInsight(byProfile);

    return { summary, byProfile, bySource, insight };
  }),

  activity: protectedProcedure
    .input(
      z
        .object({ limit: z.number().int().min(1).max(100).default(30) })
        .optional(),
    )
    .query(({ ctx, input }) =>
      ctx.db.query.activityLog.findMany({
        where: eq(activityLog.userId, ctx.user.id),
        orderBy: [desc(activityLog.createdAt)],
        limit: input?.limit ?? 30,
      }),
    ),

  notifications: protectedProcedure.query(({ ctx }) =>
    ctx.db.query.notifications.findMany({
      where: eq(notifications.userId, ctx.user.id),
      orderBy: [desc(notifications.createdAt)],
      limit: 40,
    }),
  ),

  markNotificationRead: protectedProcedure
    .input(z.object({ id: uuidSchema }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(notifications)
        .set({ readAt: new Date() })
        .where(
          and(
            eq(notifications.id, input.id),
            eq(notifications.userId, ctx.user.id),
          ),
        );
      return { id: input.id };
    }),

  markAllNotificationsRead: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(eq(notifications.userId, ctx.user.id));
    return { ok: true as const };
  }),
});
