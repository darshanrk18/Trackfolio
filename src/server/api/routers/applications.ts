import { TRPCError } from "@trpc/server";
import {
  and,
  arrayOverlaps,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  isNull,
  or,
  sql,
} from "drizzle-orm";
import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  rateLimited,
} from "@/server/api/trpc";
import {
  applicationStatusSchema,
  documentContentSchema,
  emptyToNull,
  jobDescriptionSchema,
  mediumTextSchema,
  notesSchema,
  optionalDateSchema,
  optionalUrlSchema,
  prioritySchema,
  roleProfileSchema,
  shortTextSchema,
  uuidSchema,
  workModeSchema,
} from "@/server/api/schemas";
import {
  activityLog,
  applicationContacts,
  applicationEvents,
  applications,
  applicationStatusEnum,
  contacts,
  documentVersions,
  eventTypeEnum,
  PIPELINE_STAGES,
  type Application,
  type ApplicationStatus,
  type JdAnalysisSnapshot,
} from "@/server/db/schema";
import {
  extractRequirements,
  matchAgainstResume,
  type MatchedTerm,
} from "@/lib/analysis/keywords";

/**
 * The application pipeline is the system of record for what a company actually
 * received. Two invariants shape everything below:
 *
 * 1. **Snapshots are copies, not references.** Attaching a document version
 *    copies its bytes into `resumeSnapshot` / `coverLetterSnapshot`. Deleting
 *    the version later must never rewrite the record of what was submitted.
 * 2. **Status history is append-only.** Every transition writes an
 *    `applicationEvents` row instead of overwriting a single field, which is
 *    what makes the timeline and the funnel analytics possible.
 */

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  wishlist: "Wishlist",
  applied: "Applied",
  screen: "Recruiter screen",
  assessment: "Assessment",
  interview: "Interview",
  final: "Final round",
  offer: "Offer",
  accepted: "Accepted",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
  ghosted: "Ghosted",
};

/** Statuses that represent a live, in-flight conversation with a company. */
const ACTIVE_STATUSES = [
  "applied",
  "screen",
  "assessment",
  "interview",
  "final",
] as const satisfies readonly ApplicationStatus[];

const eventTypeSchema = z.enum(eventTypeEnum.enumValues);

const tagsSchema = z.array(z.string().trim().min(1).max(40)).max(24);

const jdTermSchema = z.object({
  term: z.string(),
  weight: z.number(),
  present: z.boolean(),
});

const jdAnalysisSchema = z.object({
  analyzedAt: z.string(),
  matchPct: z.number(),
  must: z.array(jdTermSchema),
  preferred: z.array(jdTermSchema),
  other: z.array(jdTermSchema),
});

const interviewPrepSchema = z.object({
  stories: z.string().max(20_000).optional(),
  technical: z.string().max(20_000).optional(),
  questions: z.string().max(20_000).optional(),
  notes: z.string().max(20_000).optional(),
  generated: z
    .array(
      z.object({
        id: z.string(),
        question: z.string(),
        category: z.string(),
        rationale: z.string().optional(),
        answer: z.string().optional(),
      }),
    )
    .max(100)
    .optional(),
});

async function loadApplication(
  db: typeof import("@/server/db").db,
  userId: string,
  id: string,
): Promise<Application> {
  const application = await db.query.applications.findFirst({
    where: and(eq(applications.id, id), eq(applications.userId, userId)),
  });
  if (!application) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Application not found." });
  }
  return application;
}

/** Reads the immutable bytes of a version the caller owns. */
async function versionContent(
  db: typeof import("@/server/db").db,
  userId: string,
  versionId: string,
): Promise<string> {
  const version = await db.query.documentVersions.findFirst({
    where: and(
      eq(documentVersions.id, versionId),
      eq(documentVersions.userId, userId),
    ),
    columns: { content: true },
  });
  if (!version) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Document version not found.",
    });
  }
  return version.content;
}

function buildJdAnalysis(
  jobDescription: string,
  resumeSource: string,
): JdAnalysisSnapshot {
  const match = matchAgainstResume(
    extractRequirements(jobDescription),
    resumeSource,
  );
  const project = (terms: MatchedTerm[]) =>
    terms.map(({ term, weight, present }) => ({ term, weight, present }));

  return {
    analyzedAt: new Date().toISOString(),
    matchPct: match.score,
    must: project(match.must),
    preferred: project(match.preferred),
    other: project(match.other),
  };
}

/** ILIKE pattern with the wildcard characters neutralised. */
function likePattern(search: string): string {
  return `%${search.trim().replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

const LIST_ORDER = {
  updated: [desc(applications.updatedAt)],
  // NULLS LAST so undated wishlist rows never lead a date-sorted list.
  applied: [sql`${applications.appliedOn} desc nulls last`],
  company: [asc(applications.company), asc(applications.role)],
  status: [asc(applications.status), desc(applications.updatedAt)],
} as const;

export const applicationsRouter = createTRPCRouter({
  // -------------------------------------------------------------------------
  // Reads
  // -------------------------------------------------------------------------

  list: protectedProcedure
    .input(
      z
        .object({
          status: applicationStatusSchema
            .or(z.array(applicationStatusSchema).max(11))
            .optional(),
          search: shortTextSchema.optional(),
          priority: prioritySchema.optional(),
          tags: tagsSchema.optional(),
          archived: z.boolean().optional(),
          sort: z.enum(["updated", "applied", "company", "status"]).optional(),
          limit: z.number().int().min(1).max(200).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(applications.userId, ctx.user.id)];

      conditions.push(
        input?.archived
          ? isNotNull(applications.archivedAt)
          : isNull(applications.archivedAt),
      );

      if (input?.status) {
        conditions.push(
          Array.isArray(input.status)
            ? inArray(applications.status, input.status)
            : eq(applications.status, input.status),
        );
      }
      if (input?.priority) {
        conditions.push(eq(applications.priority, input.priority));
      }
      if (input?.tags?.length) {
        conditions.push(arrayOverlaps(applications.tags, input.tags));
      }
      if (input?.search?.trim()) {
        const pattern = likePattern(input.search);
        conditions.push(
          or(
            ilike(applications.company, pattern),
            ilike(applications.role, pattern),
          )!,
        );
      }

      // The board and table views never render the frozen documents, and those
      // columns dominate the row size, so they are excluded from list payloads.
      return ctx.db.query.applications.findMany({
        where: and(...conditions),
        columns: {
          resumeSnapshot: false,
          coverLetterSnapshot: false,
          jobDescription: false,
        },
        orderBy: [...LIST_ORDER[input?.sort ?? "updated"]],
        limit: input?.limit ?? 200,
      });
    }),

  byId: protectedProcedure
    .input(z.object({ id: uuidSchema }))
    .query(async ({ ctx, input }) => {
      const application = await loadApplication(ctx.db, ctx.user.id, input.id);

      const [events, links] = await Promise.all([
        ctx.db.query.applicationEvents.findMany({
          where: and(
            eq(applicationEvents.applicationId, application.id),
            eq(applicationEvents.userId, ctx.user.id),
          ),
          orderBy: [desc(applicationEvents.occurredAt)],
        }),
        ctx.db
          .select({ contact: contacts, role: applicationContacts.role })
          .from(applicationContacts)
          .innerJoin(contacts, eq(applicationContacts.contactId, contacts.id))
          .where(
            and(
              eq(applicationContacts.applicationId, application.id),
              eq(contacts.userId, ctx.user.id),
            ),
          ),
      ]);

      return {
        ...application,
        events,
        contacts: links.map((link) => ({ ...link.contact, linkRole: link.role })),
      };
    }),

  stats: protectedProcedure
    .input(z.object({ includeArchived: z.boolean().default(false) }).optional())
    .query(async ({ ctx, input }) => {
      const conditions = [eq(applications.userId, ctx.user.id)];
      if (!input?.includeArchived) {
        conditions.push(isNull(applications.archivedAt));
      }

      const rows = await ctx.db
        .select({
          status: applications.status,
          count: sql<number>`count(*)::int`,
        })
        .from(applications)
        .where(and(...conditions))
        .groupBy(applications.status);

      const byStatus = Object.fromEntries(
        applicationStatusEnum.enumValues.map((status) => [status, 0]),
      ) as Record<ApplicationStatus, number>;

      for (const row of rows) byStatus[row.status] = row.count;

      return {
        byStatus,
        stages: PIPELINE_STAGES.map((status) => ({
          status,
          count: byStatus[status],
        })),
        total: rows.reduce((sum, row) => sum + row.count, 0),
        active: ACTIVE_STATUSES.reduce((sum, status) => sum + byStatus[status], 0),
        // An accepted offer is still an offer received.
        offers: byStatus.offer + byStatus.accepted,
      };
    }),

  // -------------------------------------------------------------------------
  // Writes
  // -------------------------------------------------------------------------

  create: protectedProcedure
    .use(rateLimited("mutation"))
    .input(
      z.object({
        company: z.string().trim().min(1, "Company is required.").max(200),
        role: shortTextSchema.default(""),
        location: shortTextSchema.nullish(),
        workMode: workModeSchema.default("unknown"),
        source: shortTextSchema.nullish(),
        jobUrl: optionalUrlSchema,
        jobId: shortTextSchema.nullish(),
        status: applicationStatusSchema.default("applied"),
        priority: prioritySchema.default("medium"),
        appliedOn: optionalDateSchema,
        followUpOn: optionalDateSchema,
        salaryMin: z.number().int().min(0).max(100_000_000).nullish(),
        salaryMax: z.number().int().min(0).max(100_000_000).nullish(),
        jobDescription: jobDescriptionSchema.nullish(),
        resumeVersionId: uuidSchema.nullish(),
        coverLetterVersionId: uuidSchema.nullish(),
        profile: roleProfileSchema.nullish(),
        tags: tagsSchema.default([]),
        notes: notesSchema.default(""),
        nextStep: mediumTextSchema.nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // The snapshot is the product's core promise: freeze the bytes now so a
      // later deletion of the version cannot change what this company received.
      const [resumeSnapshot, coverLetterSnapshot] = await Promise.all([
        input.resumeVersionId
          ? versionContent(ctx.db, ctx.user.id, input.resumeVersionId)
          : null,
        input.coverLetterVersionId
          ? versionContent(ctx.db, ctx.user.id, input.coverLetterVersionId)
          : null,
      ]);

      const [created] = await ctx.db
        .insert(applications)
        .values({
          userId: ctx.user.id,
          company: input.company,
          role: input.role,
          location: emptyToNull(input.location),
          workMode: input.workMode,
          source: emptyToNull(input.source),
          jobUrl: emptyToNull(input.jobUrl),
          jobId: emptyToNull(input.jobId),
          status: input.status,
          priority: input.priority,
          appliedOn: emptyToNull(input.appliedOn),
          followUpOn: emptyToNull(input.followUpOn),
          salaryMin: input.salaryMin ?? null,
          salaryMax: input.salaryMax ?? null,
          jobDescription: emptyToNull(input.jobDescription),
          resumeVersionId: input.resumeVersionId ?? null,
          resumeSnapshot,
          coverLetterVersionId: input.coverLetterVersionId ?? null,
          coverLetterSnapshot,
          submittedAt: input.status === "wishlist" ? null : new Date(),
          profile: input.profile ?? null,
          tags: input.tags,
          notes: input.notes,
          nextStep: emptyToNull(input.nextStep),
        })
        .returning();

      if (!created) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Could not create application.",
        });
      }

      await ctx.db.insert(applicationEvents).values({
        userId: ctx.user.id,
        applicationId: created.id,
        type: "created",
        label: `Tracking ${created.company}${created.role ? ` — ${created.role}` : ""}`,
        toStatus: created.status,
      });

      await ctx.db.insert(activityLog).values({
        userId: ctx.user.id,
        kind: "application",
        label: `Added ${created.company}${created.role ? ` — ${created.role}` : ""}`,
        entityId: created.id,
        entityType: "application",
        metadata: { status: created.status },
      });

      return created;
    }),

  update: protectedProcedure
    .use(rateLimited("mutation"))
    .input(
      z.object({
        id: uuidSchema,
        company: z.string().trim().min(1).max(200).optional(),
        role: shortTextSchema.optional(),
        location: shortTextSchema.nullish(),
        workMode: workModeSchema.optional(),
        source: shortTextSchema.nullish(),
        jobUrl: optionalUrlSchema,
        jobId: shortTextSchema.nullish(),
        status: applicationStatusSchema.optional(),
        priority: prioritySchema.optional(),
        appliedOn: optionalDateSchema,
        followUpOn: optionalDateSchema,
        interviewOn: z.coerce.date().nullish(),
        decisionOn: optionalDateSchema,
        salaryMin: z.number().int().min(0).max(100_000_000).nullish(),
        salaryMax: z.number().int().min(0).max(100_000_000).nullish(),
        salaryCurrency: z.string().trim().length(3).optional(),
        resumeVersionId: uuidSchema.nullish(),
        coverLetterVersionId: uuidSchema.nullish(),
        resumePdfUrl: optionalUrlSchema,
        profile: roleProfileSchema.nullish(),
        tags: tagsSchema.optional(),
        notes: notesSchema.optional(),
        nextStep: mediumTextSchema.nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const application = await loadApplication(ctx.db, ctx.user.id, input.id);
      const { id, ...patch } = input;

      const statusChanged =
        patch.status !== undefined && patch.status !== application.status;

      // Re-freeze from the newly selected version. A version being cleared does
      // not clear the snapshot: the old bytes are still what was submitted.
      let resumeSnapshot: string | undefined;
      if (
        patch.resumeVersionId &&
        patch.resumeVersionId !== application.resumeVersionId
      ) {
        resumeSnapshot = await versionContent(
          ctx.db,
          ctx.user.id,
          patch.resumeVersionId,
        );
      }

      let coverLetterSnapshot: string | undefined;
      if (
        patch.coverLetterVersionId &&
        patch.coverLetterVersionId !== application.coverLetterVersionId
      ) {
        coverLetterSnapshot = await versionContent(
          ctx.db,
          ctx.user.id,
          patch.coverLetterVersionId,
        );
      }

      const submittedAt =
        statusChanged &&
        !application.submittedAt &&
        patch.status !== "wishlist"
          ? new Date()
          : undefined;

      const [updated] = await ctx.db
        .update(applications)
        .set({
          ...(patch.company !== undefined ? { company: patch.company } : {}),
          ...(patch.role !== undefined ? { role: patch.role } : {}),
          ...(patch.location !== undefined
            ? { location: emptyToNull(patch.location) }
            : {}),
          ...(patch.workMode !== undefined ? { workMode: patch.workMode } : {}),
          ...(patch.source !== undefined
            ? { source: emptyToNull(patch.source) }
            : {}),
          ...(patch.jobUrl !== undefined
            ? { jobUrl: emptyToNull(patch.jobUrl) }
            : {}),
          ...(patch.jobId !== undefined
            ? { jobId: emptyToNull(patch.jobId) }
            : {}),
          ...(patch.status !== undefined ? { status: patch.status } : {}),
          ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
          ...(patch.appliedOn !== undefined
            ? { appliedOn: emptyToNull(patch.appliedOn) }
            : {}),
          ...(patch.followUpOn !== undefined
            ? { followUpOn: emptyToNull(patch.followUpOn) }
            : {}),
          ...(patch.interviewOn !== undefined
            ? { interviewOn: patch.interviewOn ?? null }
            : {}),
          ...(patch.decisionOn !== undefined
            ? { decisionOn: emptyToNull(patch.decisionOn) }
            : {}),
          ...(patch.salaryMin !== undefined
            ? { salaryMin: patch.salaryMin ?? null }
            : {}),
          ...(patch.salaryMax !== undefined
            ? { salaryMax: patch.salaryMax ?? null }
            : {}),
          ...(patch.salaryCurrency !== undefined
            ? { salaryCurrency: patch.salaryCurrency.toUpperCase() }
            : {}),
          ...(patch.resumeVersionId !== undefined
            ? { resumeVersionId: patch.resumeVersionId ?? null }
            : {}),
          ...(resumeSnapshot !== undefined ? { resumeSnapshot } : {}),
          ...(patch.coverLetterVersionId !== undefined
            ? { coverLetterVersionId: patch.coverLetterVersionId ?? null }
            : {}),
          ...(coverLetterSnapshot !== undefined ? { coverLetterSnapshot } : {}),
          ...(patch.resumePdfUrl !== undefined
            ? { resumePdfUrl: emptyToNull(patch.resumePdfUrl) }
            : {}),
          ...(patch.profile !== undefined
            ? { profile: patch.profile ?? null }
            : {}),
          ...(patch.tags !== undefined ? { tags: patch.tags } : {}),
          ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
          ...(patch.nextStep !== undefined
            ? { nextStep: emptyToNull(patch.nextStep) }
            : {}),
          ...(submittedAt ? { submittedAt } : {}),
        })
        .where(
          and(eq(applications.id, id), eq(applications.userId, ctx.user.id)),
        )
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Application not found.",
        });
      }

      if (statusChanged && patch.status) {
        await ctx.db.insert(applicationEvents).values({
          userId: ctx.user.id,
          applicationId: updated.id,
          type: "status_change",
          label: `Status → ${STATUS_LABELS[patch.status]}`,
          fromStatus: application.status,
          toStatus: patch.status,
        });
      }

      return updated;
    }),

  /**
   * Focused transition used by the Kanban board. Deliberately not rate limited:
   * a drag-and-drop fires one call per drop and must never be rejected.
   */
  updateStatus: protectedProcedure
    .input(z.object({ id: uuidSchema, status: applicationStatusSchema }))
    .mutation(async ({ ctx, input }) => {
      const application = await loadApplication(ctx.db, ctx.user.id, input.id);

      if (application.status === input.status) return application;

      const submittedAt =
        !application.submittedAt && input.status !== "wishlist"
          ? new Date()
          : undefined;

      const [updated] = await ctx.db
        .update(applications)
        .set({
          status: input.status,
          ...(submittedAt ? { submittedAt } : {}),
        })
        .where(
          and(
            eq(applications.id, input.id),
            eq(applications.userId, ctx.user.id),
          ),
        )
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Application not found.",
        });
      }

      await ctx.db.insert(applicationEvents).values({
        userId: ctx.user.id,
        applicationId: updated.id,
        type: "status_change",
        label: `Status → ${STATUS_LABELS[input.status]}`,
        fromStatus: application.status,
        toStatus: input.status,
      });

      return updated;
    }),

  /** Returns the deleted row so the client can offer an undo. */
  delete: protectedProcedure
    .input(z.object({ id: uuidSchema }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.db
        .delete(applications)
        .where(
          and(
            eq(applications.id, input.id),
            eq(applications.userId, ctx.user.id),
          ),
        )
        .returning();

      if (!deleted) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Application not found.",
        });
      }

      await ctx.db.insert(activityLog).values({
        userId: ctx.user.id,
        kind: "application",
        label: `Deleted ${deleted.company}`,
        entityId: deleted.id,
        entityType: "application",
      });

      return deleted;
    }),

  /**
   * Undo for `delete`. The client round-trips the row it was given, so `userId`
   * is taken from the session rather than the payload — otherwise undo would be
   * a way to write rows into someone else's account.
   */
  restore: protectedProcedure
    .use(rateLimited("mutation"))
    .input(
      z.object({
        application: z.object({
          id: uuidSchema,
          company: z.string().trim().min(1).max(200),
          role: shortTextSchema.default(""),
          location: shortTextSchema.nullish(),
          workMode: workModeSchema.default("unknown"),
          jobId: shortTextSchema.nullish(),
          jobUrl: z.string().nullish(),
          source: shortTextSchema.nullish(),
          status: applicationStatusSchema.default("applied"),
          priority: prioritySchema.default("medium"),
          appliedOn: optionalDateSchema,
          followUpOn: optionalDateSchema,
          interviewOn: z.coerce.date().nullish(),
          decisionOn: optionalDateSchema,
          salaryMin: z.number().int().nullish(),
          salaryMax: z.number().int().nullish(),
          salaryCurrency: z.string().trim().max(3).default("USD"),
          resumeVersionId: uuidSchema.nullish(),
          resumeSnapshot: documentContentSchema.nullish(),
          coverLetterVersionId: uuidSchema.nullish(),
          coverLetterSnapshot: documentContentSchema.nullish(),
          resumePdfUrl: z.string().nullish(),
          submittedAt: z.coerce.date().nullish(),
          jobDescription: jobDescriptionSchema.nullish(),
          jobDescriptionFetchedAt: z.coerce.date().nullish(),
          jdAnalysis: jdAnalysisSchema.nullish(),
          profile: roleProfileSchema.nullish(),
          nextStep: mediumTextSchema.nullish(),
          notes: notesSchema.default(""),
          tags: tagsSchema.default([]),
          interviewPrep: interviewPrepSchema.default({}),
          archivedAt: z.coerce.date().nullish(),
          createdAt: z.coerce.date().nullish(),
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const row = input.application;

      const [restored] = await ctx.db
        .insert(applications)
        .values({
          id: row.id,
          userId: ctx.user.id,
          company: row.company,
          role: row.role,
          location: emptyToNull(row.location),
          workMode: row.workMode,
          jobId: emptyToNull(row.jobId),
          jobUrl: emptyToNull(row.jobUrl),
          source: emptyToNull(row.source),
          status: row.status,
          priority: row.priority,
          appliedOn: emptyToNull(row.appliedOn),
          followUpOn: emptyToNull(row.followUpOn),
          interviewOn: row.interviewOn ?? null,
          decisionOn: emptyToNull(row.decisionOn),
          salaryMin: row.salaryMin ?? null,
          salaryMax: row.salaryMax ?? null,
          salaryCurrency: row.salaryCurrency || "USD",
          resumeVersionId: row.resumeVersionId ?? null,
          resumeSnapshot: row.resumeSnapshot ?? null,
          coverLetterVersionId: row.coverLetterVersionId ?? null,
          coverLetterSnapshot: row.coverLetterSnapshot ?? null,
          resumePdfUrl: emptyToNull(row.resumePdfUrl),
          submittedAt: row.submittedAt ?? null,
          jobDescription: emptyToNull(row.jobDescription),
          jobDescriptionFetchedAt: row.jobDescriptionFetchedAt ?? null,
          jdAnalysis: row.jdAnalysis ?? null,
          profile: row.profile ?? null,
          nextStep: emptyToNull(row.nextStep),
          notes: row.notes,
          tags: row.tags,
          interviewPrep: row.interviewPrep,
          archivedAt: row.archivedAt ?? null,
          ...(row.createdAt ? { createdAt: row.createdAt } : {}),
        })
        .onConflictDoNothing({ target: applications.id })
        .returning();

      if (!restored) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This application already exists.",
        });
      }

      return restored;
    }),

  archive: protectedProcedure
    .input(z.object({ id: uuidSchema }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(applications)
        .set({ archivedAt: new Date() })
        .where(
          and(
            eq(applications.id, input.id),
            eq(applications.userId, ctx.user.id),
          ),
        )
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Application not found.",
        });
      }
      return updated;
    }),

  unarchive: protectedProcedure
    .input(z.object({ id: uuidSchema }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(applications)
        .set({ archivedAt: null })
        .where(
          and(
            eq(applications.id, input.id),
            eq(applications.userId, ctx.user.id),
          ),
        )
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Application not found.",
        });
      }
      return updated;
    }),

  /**
   * Freezes the currently-selected documents onto the application. Called when
   * a submission is confirmed, and idempotent enough to re-run safely.
   */
  captureSnapshot: protectedProcedure
    .use(rateLimited("mutation"))
    .input(
      z.object({
        id: uuidSchema,
        resumeContent: documentContentSchema.optional(),
        coverLetterContent: documentContentSchema.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const application = await loadApplication(ctx.db, ctx.user.id, input.id);

      const resumeSnapshot =
        input.resumeContent ??
        (application.resumeVersionId
          ? await versionContent(
              ctx.db,
              ctx.user.id,
              application.resumeVersionId,
            )
          : application.resumeSnapshot);

      const coverLetterSnapshot =
        input.coverLetterContent ??
        (application.coverLetterVersionId
          ? await versionContent(
              ctx.db,
              ctx.user.id,
              application.coverLetterVersionId,
            )
          : application.coverLetterSnapshot);

      if (!resumeSnapshot && !coverLetterSnapshot) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Attach a resume or cover letter before capturing a snapshot.",
        });
      }

      const [updated] = await ctx.db
        .update(applications)
        .set({
          resumeSnapshot,
          coverLetterSnapshot,
          submittedAt: application.submittedAt ?? new Date(),
        })
        .where(
          and(
            eq(applications.id, input.id),
            eq(applications.userId, ctx.user.id),
          ),
        )
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Application not found.",
        });
      }

      await ctx.db.insert(applicationEvents).values({
        userId: ctx.user.id,
        applicationId: updated.id,
        type: "snapshot",
        label: "Froze the submitted documents",
        metadata: {
          resumeChars: resumeSnapshot?.length ?? 0,
          coverLetterChars: coverLetterSnapshot?.length ?? 0,
        },
      });

      return updated;
    }),

  // -------------------------------------------------------------------------
  // Timeline
  // -------------------------------------------------------------------------

  addEvent: protectedProcedure
    .use(rateLimited("mutation"))
    .input(
      z.object({
        applicationId: uuidSchema,
        type: eventTypeSchema.default("note"),
        label: z.string().trim().min(1).max(200),
        body: notesSchema.nullish(),
        occurredAt: z.coerce.date().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await loadApplication(ctx.db, ctx.user.id, input.applicationId);

      const [event] = await ctx.db
        .insert(applicationEvents)
        .values({
          userId: ctx.user.id,
          applicationId: input.applicationId,
          type: input.type,
          label: input.label,
          body: emptyToNull(input.body),
          ...(input.occurredAt ? { occurredAt: input.occurredAt } : {}),
        })
        .returning();

      if (!event) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Could not add event.",
        });
      }
      return event;
    }),

  deleteEvent: protectedProcedure
    .input(z.object({ id: uuidSchema }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.db
        .delete(applicationEvents)
        .where(
          and(
            eq(applicationEvents.id, input.id),
            eq(applicationEvents.userId, ctx.user.id),
          ),
        )
        .returning({ id: applicationEvents.id });

      if (!deleted) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Event not found." });
      }
      return { id: deleted.id };
    }),

  // -------------------------------------------------------------------------
  // Job description & prep
  // -------------------------------------------------------------------------

  setJobDescription: protectedProcedure
    .use(rateLimited("mutation"))
    .input(z.object({ id: uuidSchema, jobDescription: jobDescriptionSchema }))
    .mutation(async ({ ctx, input }) => {
      const application = await loadApplication(ctx.db, ctx.user.id, input.id);

      // Match against the frozen bytes when they exist: the gap report should
      // describe the resume that was actually sent, not today's working copy.
      const resumeSource =
        application.resumeSnapshot ??
        (application.resumeVersionId
          ? await versionContent(
              ctx.db,
              ctx.user.id,
              application.resumeVersionId,
            )
          : "");

      const jdAnalysis = input.jobDescription.trim()
        ? buildJdAnalysis(input.jobDescription, resumeSource)
        : null;

      const [updated] = await ctx.db
        .update(applications)
        .set({
          jobDescription: input.jobDescription,
          jobDescriptionFetchedAt: new Date(),
          jdAnalysis,
        })
        .where(
          and(
            eq(applications.id, input.id),
            eq(applications.userId, ctx.user.id),
          ),
        )
        .returning();

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Application not found.",
        });
      }
      return updated;
    }),

  /** Autosaved from the prep workspace, so it merges rather than replaces. */
  saveInterviewPrep: protectedProcedure
    .input(z.object({ id: uuidSchema, prep: interviewPrepSchema }))
    .mutation(async ({ ctx, input }) => {
      const application = await loadApplication(ctx.db, ctx.user.id, input.id);

      const [updated] = await ctx.db
        .update(applications)
        .set({ interviewPrep: { ...application.interviewPrep, ...input.prep } })
        .where(
          and(
            eq(applications.id, input.id),
            eq(applications.userId, ctx.user.id),
          ),
        )
        .returning({
          id: applications.id,
          interviewPrep: applications.interviewPrep,
        });

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Application not found.",
        });
      }
      return updated;
    }),

  // -------------------------------------------------------------------------
  // Contact links
  // -------------------------------------------------------------------------

  linkContact: protectedProcedure
    .use(rateLimited("mutation"))
    .input(
      z.object({
        applicationId: uuidSchema,
        contactId: uuidSchema,
        role: shortTextSchema.nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // The join table has no `userId`, so both sides must be proven owned
      // before a row can be written into it.
      const [application, contact] = await Promise.all([
        ctx.db.query.applications.findFirst({
          where: and(
            eq(applications.id, input.applicationId),
            eq(applications.userId, ctx.user.id),
          ),
          columns: { id: true },
        }),
        ctx.db.query.contacts.findFirst({
          where: and(
            eq(contacts.id, input.contactId),
            eq(contacts.userId, ctx.user.id),
          ),
          columns: { id: true },
        }),
      ]);

      if (!application) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Application not found.",
        });
      }
      if (!contact) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Contact not found." });
      }

      await ctx.db
        .insert(applicationContacts)
        .values({
          applicationId: application.id,
          contactId: contact.id,
          role: emptyToNull(input.role),
        })
        .onConflictDoNothing();

      return { applicationId: application.id, contactId: contact.id };
    }),

  unlinkContact: protectedProcedure
    .input(
      z.object({ applicationId: uuidSchema, contactId: uuidSchema }),
    )
    .mutation(async ({ ctx, input }) => {
      const application = await ctx.db.query.applications.findFirst({
        where: and(
          eq(applications.id, input.applicationId),
          eq(applications.userId, ctx.user.id),
        ),
        columns: { id: true },
      });

      if (!application) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Application not found.",
        });
      }

      await ctx.db
        .delete(applicationContacts)
        .where(
          and(
            eq(applicationContacts.applicationId, application.id),
            eq(applicationContacts.contactId, input.contactId),
          ),
        );

      return { applicationId: application.id, contactId: input.contactId };
    }),
});
