import { TRPCError } from "@trpc/server";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  rateLimited,
} from "@/server/api/trpc";
import { uuidSchema } from "@/server/api/schemas";
import {
  activityLog,
  applicationContacts,
  applicationEvents,
  applications,
  branches,
  contacts,
  documentVersions,
  savedJobDescriptions,
  watchTerms,
} from "@/server/db/schema";
import { purgeUserContent } from "@/server/services/purge";
import { logger } from "@/server/lib/logger";
import { STATUS_LABELS } from "@/lib/pipeline";

const BACKUP_VERSION = 1 as const;

const backupSchema = z.object({
  version: z.literal(1),
  exportedAt: z.string(),
  branches: z.array(z.record(z.string(), z.unknown())).default([]),
  versions: z.array(z.record(z.string(), z.unknown())).default([]),
  applications: z.array(z.record(z.string(), z.unknown())).default([]),
  events: z.array(z.record(z.string(), z.unknown())).default([]),
  contacts: z.array(z.record(z.string(), z.unknown())).default([]),
  contactLinks: z.array(z.record(z.string(), z.unknown())).default([]),
  watchTerms: z.array(z.record(z.string(), z.unknown())).default([]),
  savedJobDescriptions: z.array(z.record(z.string(), z.unknown())).default([]),
});

function csvEscape(value: unknown): string {
  const text = value == null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export const dataRouter = createTRPCRouter({
  exportBackup: protectedProcedure
    .use(rateLimited("mutation"))
    .mutation(async ({ ctx }) => {
      const userId = ctx.user.id;
      const [
        branchRows,
        versionRows,
        applicationRows,
        eventRows,
        contactRows,
        termRows,
        jdRows,
      ] = await Promise.all([
        ctx.db.query.branches.findMany({ where: eq(branches.userId, userId) }),
        ctx.db.query.documentVersions.findMany({
          where: eq(documentVersions.userId, userId),
        }),
        ctx.db.query.applications.findMany({
          where: eq(applications.userId, userId),
        }),
        ctx.db.query.applicationEvents.findMany({
          where: eq(applicationEvents.userId, userId),
        }),
        ctx.db.query.contacts.findMany({ where: eq(contacts.userId, userId) }),
        ctx.db.query.watchTerms.findMany({
          where: eq(watchTerms.userId, userId),
        }),
        ctx.db.query.savedJobDescriptions.findMany({
          where: eq(savedJobDescriptions.userId, userId),
        }),
      ]);

      const appIds = applicationRows.map((a) => a.id);
      const ownedLinks =
        appIds.length === 0
          ? []
          : await ctx.db.query.applicationContacts.findMany({
              where: inArray(applicationContacts.applicationId, appIds),
            });

      await ctx.db.insert(activityLog).values({
        userId,
        kind: "export",
        label: "Downloaded a full backup",
      });

      return {
        version: BACKUP_VERSION,
        exportedAt: new Date().toISOString(),
        branches: branchRows,
        versions: versionRows,
        applications: applicationRows,
        events: eventRows,
        contacts: contactRows,
        contactLinks: ownedLinks,
        watchTerms: termRows,
        savedJobDescriptions: jdRows,
      };
    }),

  exportApplicationsCsv: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db.query.applications.findMany({
      where: eq(applications.userId, ctx.user.id),
      orderBy: (t, { desc }) => [desc(t.updatedAt)],
    });

    const header = [
      "company",
      "role",
      "status",
      "priority",
      "applied_on",
      "source",
      "location",
      "job_url",
      "follow_up_on",
    ];
    const lines = [
      header.join(","),
      ...rows.map((row) =>
        [
          row.company,
          row.role,
          STATUS_LABELS[row.status],
          row.priority,
          row.appliedOn,
          row.source,
          row.location,
          row.jobUrl,
          row.followUpOn,
        ]
          .map(csvEscape)
          .join(","),
      ),
    ];
    return { csv: lines.join("\n"), count: rows.length };
  }),

  importBackup: protectedProcedure
    .use(rateLimited("mutation"))
    .input(z.object({ payload: z.unknown() }))
    .mutation(async ({ ctx, input }) => {
      const parsed = backupSchema.safeParse(input.payload);
      if (!parsed.success) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "That file is not a Trackfolio backup (expected version 1 JSON).",
        });
      }

      const backup = parsed.data;
      const userId = ctx.user.id;
      const tx = ctx.txClient();

      await tx.transaction(async (trx) => {
        await purgeUserContent(trx, userId);

        if (backup.branches.length) {
          await trx.insert(branches).values(
            backup.branches.map((row) => ({
              ...(row as typeof branches.$inferInsert),
              userId,
            })),
          );
        }
        if (backup.versions.length) {
          await trx.insert(documentVersions).values(
            backup.versions.map((row) => ({
              ...(row as typeof documentVersions.$inferInsert),
              userId,
            })),
          );
        }
        if (backup.contacts.length) {
          await trx.insert(contacts).values(
            backup.contacts.map((row) => ({
              ...(row as typeof contacts.$inferInsert),
              userId,
            })),
          );
        }
        if (backup.applications.length) {
          await trx.insert(applications).values(
            backup.applications.map((row) => ({
              ...(row as typeof applications.$inferInsert),
              userId,
            })),
          );
        }
        if (backup.events.length) {
          await trx.insert(applicationEvents).values(
            backup.events.map((row) => ({
              ...(row as typeof applicationEvents.$inferInsert),
              userId,
            })),
          );
        }
        if (backup.contactLinks.length) {
          await trx
            .insert(applicationContacts)
            .values(backup.contactLinks as (typeof applicationContacts.$inferInsert)[])
            .onConflictDoNothing();
        }
        if (backup.watchTerms.length) {
          await trx.insert(watchTerms).values(
            backup.watchTerms.map((row) => ({
              ...(row as typeof watchTerms.$inferInsert),
              userId,
            })),
          );
        }
        if (backup.savedJobDescriptions.length) {
          await trx.insert(savedJobDescriptions).values(
            backup.savedJobDescriptions.map((row) => ({
              ...(row as typeof savedJobDescriptions.$inferInsert),
              userId,
            })),
          );
        }

        await trx.insert(activityLog).values({
          userId,
          kind: "import",
          label: "Restored from backup",
        });
      });

      logger.info({ userId, exportedAt: backup.exportedAt }, "backup restored");
      return {
        restored: {
          branches: backup.branches.length,
          versions: backup.versions.length,
          applications: backup.applications.length,
          contacts: backup.contacts.length,
        },
      };
    }),

  resetContent: protectedProcedure
    .use(rateLimited("mutation"))
    .input(z.object({ confirmation: z.literal("RESET") }))
    .mutation(async ({ ctx }) => {
      const tx = ctx.txClient();
      await tx.transaction(async (trx) => {
        await purgeUserContent(trx, ctx.user.id);
        await trx.insert(activityLog).values({
          userId: ctx.user.id,
          kind: "system",
          label: "Reset all search data",
        });
      });
      return { ok: true as const };
    }),

  applicationPackage: protectedProcedure
    .input(z.object({ id: uuidSchema }))
    .query(async ({ ctx, input }) => {
      const application = await ctx.db.query.applications.findFirst({
        where: eq(applications.id, input.id),
      });
      if (!application || application.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Application not found.",
        });
      }

      return {
        company: application.company,
        role: application.role,
        status: application.status,
        appliedOn: application.appliedOn,
        jobUrl: application.jobUrl,
        jobId: application.jobId,
        location: application.location,
        source: application.source,
        submittedAt: application.submittedAt,
        resume: application.resumeSnapshot,
        coverLetter: application.coverLetterSnapshot,
        jobDescription: application.jobDescription,
        notes: application.notes,
      };
    }),
});
