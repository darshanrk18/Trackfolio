import { TRPCError } from "@trpc/server";
import { and, asc, eq, ilike, isNotNull, lte, or, sql } from "drizzle-orm";
import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  rateLimited,
} from "@/server/api/trpc";
import {
  emptyToNull,
  notesSchema,
  optionalDateSchema,
  optionalUrlSchema,
  shortTextSchema,
  uuidSchema,
} from "@/server/api/schemas";
import {
  activityLog,
  applicationContacts,
  applications,
  contacts,
  type Contact,
} from "@/server/db/schema";
import { daysSince } from "@/lib/utils";

/**
 * Contacts are the relationship side of the pipeline: recruiters, referrals and
 * hiring managers, each with an optional touch cadence so a warm introduction
 * does not quietly go cold.
 */

const tagsSchema = z.array(z.string().trim().min(1).max(40)).max(24);

const optionalEmailSchema = z
  .union([z.string().trim().email("Enter a valid email address."), z.literal("")])
  .nullish();

async function loadContact(
  db: typeof import("@/server/db").db,
  userId: string,
  id: string,
): Promise<Contact> {
  const contact = await db.query.contacts.findFirst({
    where: and(eq(contacts.id, id), eq(contacts.userId, userId)),
  });
  if (!contact) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Contact not found." });
  }
  return contact;
}

/** ILIKE pattern with the wildcard characters neutralised. */
function likePattern(search: string): string {
  return `%${search.trim().replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

/** Midnight-anchored date from a `YYYY-MM-DD` column value. */
function parseDay(value: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * The day a contact became due: the explicit next touch, or the cadence
 * counted from the last contact, whichever comes first.
 */
function dueOn(contact: Contact): Date | null {
  const explicit = parseDay(contact.nextTouchOn);
  const lastContacted = parseDay(contact.lastContactedOn);
  const cadence =
    lastContacted && contact.cadenceDays
      ? new Date(lastContacted.getTime() + contact.cadenceDays * 86_400_000)
      : null;

  if (explicit && cadence) return explicit < cadence ? explicit : cadence;
  return explicit ?? cadence;
}

export const contactsRouter = createTRPCRouter({
  // -------------------------------------------------------------------------
  // Reads
  // -------------------------------------------------------------------------

  list: protectedProcedure
    .input(
      z
        .object({
          search: shortTextSchema.optional(),
          company: shortTextSchema.optional(),
          limit: z.number().int().min(1).max(200).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(contacts.userId, ctx.user.id)];

      if (input?.search?.trim()) {
        const pattern = likePattern(input.search);
        conditions.push(
          or(
            ilike(contacts.name, pattern),
            ilike(contacts.company, pattern),
            ilike(contacts.email, pattern),
          )!,
        );
      }
      if (input?.company?.trim()) {
        conditions.push(
          sql`lower(${contacts.company}) = lower(${input.company.trim()})`,
        );
      }

      return ctx.db.query.contacts.findMany({
        where: and(...conditions),
        orderBy: [asc(contacts.name)],
        limit: input?.limit ?? 200,
      });
    }),

  byId: protectedProcedure
    .input(z.object({ id: uuidSchema }))
    .query(async ({ ctx, input }) => {
      const contact = await loadContact(ctx.db, ctx.user.id, input.id);

      // The join table has no `userId`, so ownership is enforced on the
      // application side of the join rather than on the link row.
      const links = await ctx.db
        .select({
          id: applications.id,
          company: applications.company,
          role: applications.role,
          status: applications.status,
          priority: applications.priority,
          appliedOn: applications.appliedOn,
          archivedAt: applications.archivedAt,
          linkRole: applicationContacts.role,
        })
        .from(applicationContacts)
        .innerJoin(
          applications,
          eq(applicationContacts.applicationId, applications.id),
        )
        .where(
          and(
            eq(applicationContacts.contactId, contact.id),
            eq(applications.userId, ctx.user.id),
          ),
        );

      return { ...contact, applications: links };
    }),

  /** Case-insensitive company lookup, used by the application workspace. */
  byCompany: protectedProcedure
    .input(z.object({ company: z.string().trim().min(1).max(200) }))
    .query(({ ctx, input }) =>
      ctx.db.query.contacts.findMany({
        where: and(
          eq(contacts.userId, ctx.user.id),
          sql`lower(${contacts.company}) = lower(${input.company})`,
        ),
        orderBy: [asc(contacts.name)],
      }),
    ),

  /**
   * Relationships that have gone past due, either by an explicit next-touch
   * date or by exceeding their cadence since the last contact.
   */
  needsFollowUp: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(200).default(50) }).optional())
    .query(async ({ ctx, input }) => {
      const today = new Date().toISOString().slice(0, 10);

      const rows = await ctx.db.query.contacts.findMany({
        where: and(
          eq(contacts.userId, ctx.user.id),
          or(
            and(
              isNotNull(contacts.nextTouchOn),
              lte(contacts.nextTouchOn, today),
            ),
            and(
              isNotNull(contacts.cadenceDays),
              isNotNull(contacts.lastContactedOn),
              // `date + integer` is date arithmetic in Postgres.
              sql`${contacts.lastContactedOn} + ${contacts.cadenceDays} <= current_date`,
            ),
          )!,
        ),
        orderBy: [asc(contacts.nextTouchOn), asc(contacts.lastContactedOn)],
        limit: input?.limit ?? 50,
      });

      return rows
        .map((contact) => ({
          ...contact,
          daysOverdue: Math.max(0, daysSince(dueOn(contact)) ?? 0),
        }))
        .sort((a, b) => b.daysOverdue - a.daysOverdue);
    }),

  // -------------------------------------------------------------------------
  // Writes
  // -------------------------------------------------------------------------

  create: protectedProcedure
    .use(rateLimited("mutation"))
    .input(
      z.object({
        name: z.string().trim().min(1, "A name is required.").max(200),
        company: shortTextSchema.nullish(),
        title: shortTextSchema.nullish(),
        relation: shortTextSchema.nullish(),
        email: optionalEmailSchema,
        phone: shortTextSchema.nullish(),
        linkedinUrl: optionalUrlSchema,
        lastContactedOn: optionalDateSchema,
        nextTouchOn: optionalDateSchema,
        cadenceDays: z.number().int().min(1).max(365).nullish(),
        notes: notesSchema.default(""),
        tags: tagsSchema.default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [created] = await ctx.db
        .insert(contacts)
        .values({
          userId: ctx.user.id,
          name: input.name,
          company: emptyToNull(input.company),
          title: emptyToNull(input.title),
          relation: emptyToNull(input.relation),
          email: emptyToNull(input.email),
          phone: emptyToNull(input.phone),
          linkedinUrl: emptyToNull(input.linkedinUrl),
          lastContactedOn: emptyToNull(input.lastContactedOn),
          nextTouchOn: emptyToNull(input.nextTouchOn),
          cadenceDays: input.cadenceDays ?? null,
          notes: input.notes,
          tags: input.tags,
        })
        .returning();

      if (!created) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Could not create contact.",
        });
      }

      await ctx.db.insert(activityLog).values({
        userId: ctx.user.id,
        kind: "contact",
        label: `Added contact ${created.name}`,
        entityId: created.id,
        entityType: "contact",
      });

      return created;
    }),

  update: protectedProcedure
    .use(rateLimited("mutation"))
    .input(
      z.object({
        id: uuidSchema,
        name: z.string().trim().min(1).max(200).optional(),
        company: shortTextSchema.nullish(),
        title: shortTextSchema.nullish(),
        relation: shortTextSchema.nullish(),
        email: optionalEmailSchema,
        phone: shortTextSchema.nullish(),
        linkedinUrl: optionalUrlSchema,
        lastContactedOn: optionalDateSchema,
        nextTouchOn: optionalDateSchema,
        cadenceDays: z.number().int().min(1).max(365).nullish(),
        notes: notesSchema.optional(),
        tags: tagsSchema.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...patch } = input;

      const [updated] = await ctx.db
        .update(contacts)
        .set({
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.company !== undefined
            ? { company: emptyToNull(patch.company) }
            : {}),
          ...(patch.title !== undefined
            ? { title: emptyToNull(patch.title) }
            : {}),
          ...(patch.relation !== undefined
            ? { relation: emptyToNull(patch.relation) }
            : {}),
          ...(patch.email !== undefined
            ? { email: emptyToNull(patch.email) }
            : {}),
          ...(patch.phone !== undefined
            ? { phone: emptyToNull(patch.phone) }
            : {}),
          ...(patch.linkedinUrl !== undefined
            ? { linkedinUrl: emptyToNull(patch.linkedinUrl) }
            : {}),
          ...(patch.lastContactedOn !== undefined
            ? { lastContactedOn: emptyToNull(patch.lastContactedOn) }
            : {}),
          ...(patch.nextTouchOn !== undefined
            ? { nextTouchOn: emptyToNull(patch.nextTouchOn) }
            : {}),
          ...(patch.cadenceDays !== undefined
            ? { cadenceDays: patch.cadenceDays ?? null }
            : {}),
          ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
          ...(patch.tags !== undefined ? { tags: patch.tags } : {}),
        })
        .where(and(eq(contacts.id, id), eq(contacts.userId, ctx.user.id)))
        .returning();

      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Contact not found." });
      }
      return updated;
    }),

  /** Returns the deleted row so the client can offer an undo. */
  delete: protectedProcedure
    .input(z.object({ id: uuidSchema }))
    .mutation(async ({ ctx, input }) => {
      const [deleted] = await ctx.db
        .delete(contacts)
        .where(and(eq(contacts.id, input.id), eq(contacts.userId, ctx.user.id)))
        .returning();

      if (!deleted) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Contact not found." });
      }

      await ctx.db.insert(activityLog).values({
        userId: ctx.user.id,
        kind: "contact",
        label: `Deleted contact ${deleted.name}`,
        entityId: deleted.id,
        entityType: "contact",
      });

      return deleted;
    }),

  /**
   * Undo for `delete`. `userId` comes from the session rather than the payload,
   * so a round-tripped row can never be written into another account.
   */
  restore: protectedProcedure
    .use(rateLimited("mutation"))
    .input(
      z.object({
        contact: z.object({
          id: uuidSchema,
          name: z.string().trim().min(1).max(200),
          company: shortTextSchema.nullish(),
          title: shortTextSchema.nullish(),
          relation: shortTextSchema.nullish(),
          email: z.string().nullish(),
          phone: shortTextSchema.nullish(),
          linkedinUrl: z.string().nullish(),
          lastContactedOn: optionalDateSchema,
          nextTouchOn: optionalDateSchema,
          cadenceDays: z.number().int().nullish(),
          notes: notesSchema.default(""),
          tags: tagsSchema.default([]),
          createdAt: z.coerce.date().nullish(),
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const row = input.contact;

      const [restored] = await ctx.db
        .insert(contacts)
        .values({
          id: row.id,
          userId: ctx.user.id,
          name: row.name,
          company: emptyToNull(row.company),
          title: emptyToNull(row.title),
          relation: emptyToNull(row.relation),
          email: emptyToNull(row.email),
          phone: emptyToNull(row.phone),
          linkedinUrl: emptyToNull(row.linkedinUrl),
          lastContactedOn: emptyToNull(row.lastContactedOn),
          nextTouchOn: emptyToNull(row.nextTouchOn),
          cadenceDays: row.cadenceDays ?? null,
          notes: row.notes,
          tags: row.tags,
          ...(row.createdAt ? { createdAt: row.createdAt } : {}),
        })
        .onConflictDoNothing({ target: contacts.id })
        .returning();

      if (!restored) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This contact already exists.",
        });
      }

      return restored;
    }),
});
