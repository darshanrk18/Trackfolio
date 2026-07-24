import { relations, sql } from "drizzle-orm";
import {
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { documentVersions, roleProfileEnum } from "./documents";

export const applicationStatusEnum = pgEnum("application_status", [
  "wishlist",
  "applied",
  "screen", // recruiter screen
  "assessment", // OA / take-home
  "interview",
  "final", // onsite / final round
  "offer",
  "accepted",
  "rejected",
  "withdrawn",
  "ghosted",
]);

export const priorityEnum = pgEnum("priority", ["low", "medium", "high"]);

export const workModeEnum = pgEnum("work_mode", [
  "onsite",
  "hybrid",
  "remote",
  "unknown",
]);

/**
 * Stages that represent forward progress, in order. Terminal states
 * (rejected/withdrawn/ghosted/accepted) are deliberately excluded so funnel
 * math stays monotonic.
 */
export const PIPELINE_STAGES = [
  "wishlist",
  "applied",
  "screen",
  "assessment",
  "interview",
  "final",
  "offer",
] as const;

export const applications = pgTable(
  "application",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    company: text("company").notNull(),
    role: text("role").notNull().default(""),
    location: text("location"),
    workMode: workModeEnum("work_mode").notNull().default("unknown"),
    jobId: text("job_id"),
    jobUrl: text("job_url"),
    source: text("source"), // Referral, LinkedIn, Handshake, career site…

    status: applicationStatusEnum("status").notNull().default("applied"),
    priority: priorityEnum("priority").notNull().default("medium"),

    appliedOn: date("applied_on"),
    followUpOn: date("follow_up_on"),
    interviewOn: timestamp("interview_on", { withTimezone: true }),
    decisionOn: date("decision_on"),

    salaryMin: integer("salary_min"),
    salaryMax: integer("salary_max"),
    salaryCurrency: text("salary_currency").notNull().default("USD"),

    /**
     * The exact documents that were submitted, frozen at submission time.
     * These are copies rather than references on purpose: deleting a version
     * must never rewrite the historical record of what a company received.
     */
    resumeVersionId: uuid("resume_version_id").references(
      () => documentVersions.id,
      { onDelete: "set null" },
    ),
    resumeSnapshot: text("resume_snapshot"),
    coverLetterVersionId: uuid("cover_letter_version_id").references(
      () => documentVersions.id,
      { onDelete: "set null" },
    ),
    coverLetterSnapshot: text("cover_letter_snapshot"),
    resumePdfUrl: text("resume_pdf_url"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),

    /** Archived copy of the posting, which usually disappears once filled. */
    jobDescription: text("job_description"),
    jobDescriptionFetchedAt: timestamp("jd_fetched_at", { withTimezone: true }),

    /** Cached requirement-extraction result for this posting. */
    jdAnalysis: jsonb("jd_analysis").$type<JdAnalysisSnapshot | null>(),

    profile: roleProfileEnum("profile"),
    nextStep: text("next_step"),
    notes: text("notes").notNull().default(""),
    tags: text("tags")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),

    /** Free-form prep workspace, saved per application. */
    interviewPrep: jsonb("interview_prep")
      .$type<InterviewPrep>()
      .notNull()
      .default(sql`'{}'::jsonb`),

    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("application_user_status_idx").on(t.userId, t.status),
    index("application_user_updated_idx").on(t.userId, t.updatedAt.desc()),
    index("application_user_applied_idx").on(t.userId, t.appliedOn.desc()),
    index("application_follow_up_idx").on(t.userId, t.followUpOn),
    index("application_company_idx").on(t.userId, sql`lower(${t.company})`),
  ],
);

export type JdAnalysisSnapshot = {
  analyzedAt: string;
  matchPct: number;
  must: Array<{ term: string; weight: number; present: boolean }>;
  preferred: Array<{ term: string; weight: number; present: boolean }>;
  other: Array<{ term: string; weight: number; present: boolean }>;
};

export type InterviewPrep = {
  stories?: string;
  technical?: string;
  questions?: string;
  notes?: string;
  /** AI-generated question bank, retained so it is stable between sessions. */
  generated?: Array<{
    id: string;
    question: string;
    category: string;
    rationale?: string;
    answer?: string;
  }>;
};

export const eventTypeEnum = pgEnum("application_event_type", [
  "created",
  "status_change",
  "snapshot",
  "note",
  "email",
  "call",
  "interview",
  "follow_up",
  "offer",
  "rejection",
  "ai",
]);

/**
 * Append-only timeline for an application. Modelled as rows rather than a JSON
 * blob so the activity feed, analytics and reminders can query it directly.
 */
export const applicationEvents = pgTable(
  "application_event",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),

    type: eventTypeEnum("type").notNull().default("note"),
    label: text("label").notNull(),
    body: text("body"),
    fromStatus: applicationStatusEnum("from_status"),
    toStatus: applicationStatusEnum("to_status"),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),

    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("event_application_idx").on(t.applicationId, t.occurredAt.desc()),
    index("event_user_idx").on(t.userId, t.occurredAt.desc()),
  ],
);

export const contacts = pgTable(
  "contact",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    name: text("name").notNull(),
    company: text("company"),
    title: text("title"),
    relation: text("relation"), // Recruiter, Referral, Hiring Manager…
    email: text("email"),
    phone: text("phone"),
    linkedinUrl: text("linkedin_url"),

    lastContactedOn: date("last_contacted_on"),
    nextTouchOn: date("next_touch_on"),
    /** Remind me if this relationship goes cold for N days. */
    cadenceDays: integer("cadence_days"),

    notes: text("notes").notNull().default(""),
    tags: text("tags")
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("contact_user_idx").on(t.userId, t.name),
    index("contact_company_idx").on(t.userId, sql`lower(${t.company})`),
    index("contact_next_touch_idx").on(t.userId, t.nextTouchOn),
  ],
);

/** Many-to-many: a contact can be attached to several applications. */
export const applicationContacts = pgTable(
  "application_contact",
  {
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    role: text("role"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("application_contact_unique").on(t.applicationId, t.contactId),
    index("application_contact_contact_idx").on(t.contactId),
  ],
);

export const applicationsRelations = relations(
  applications,
  ({ one, many }) => ({
    user: one(users, { fields: [applications.userId], references: [users.id] }),
    resumeVersion: one(documentVersions, {
      fields: [applications.resumeVersionId],
      references: [documentVersions.id],
      relationName: "application_resume",
    }),
    coverLetterVersion: one(documentVersions, {
      fields: [applications.coverLetterVersionId],
      references: [documentVersions.id],
      relationName: "application_cover_letter",
    }),
    events: many(applicationEvents),
    contactLinks: many(applicationContacts),
  }),
);

export const applicationEventsRelations = relations(
  applicationEvents,
  ({ one }) => ({
    application: one(applications, {
      fields: [applicationEvents.applicationId],
      references: [applications.id],
    }),
  }),
);

export const contactsRelations = relations(contacts, ({ one, many }) => ({
  user: one(users, { fields: [contacts.userId], references: [users.id] }),
  applicationLinks: many(applicationContacts),
}));

export const applicationContactsRelations = relations(
  applicationContacts,
  ({ one }) => ({
    application: one(applications, {
      fields: [applicationContacts.applicationId],
      references: [applications.id],
    }),
    contact: one(contacts, {
      fields: [applicationContacts.contactId],
      references: [contacts.id],
    }),
  }),
);

export type Application = typeof applications.$inferSelect;
export type NewApplication = typeof applications.$inferInsert;
export type ApplicationEvent = typeof applicationEvents.$inferSelect;
export type Contact = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;
export type ApplicationStatus = (typeof applicationStatusEnum.enumValues)[number];
export type Priority = (typeof priorityEnum.enumValues)[number];
