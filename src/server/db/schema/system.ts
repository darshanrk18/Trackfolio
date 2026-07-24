import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { applications } from "./pipeline";

export const activityKindEnum = pgEnum("activity_kind", [
  "document",
  "branch",
  "version",
  "application",
  "contact",
  "compile",
  "ai",
  "export",
  "import",
  "auth",
  "system",
]);

/**
 * Global user-facing activity feed. Distinct from `applicationEvents`, which is
 * scoped to a single application.
 */
export const activityLog = pgTable(
  "activity_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: activityKindEnum("kind").notNull().default("system"),
    label: text("label").notNull(),
    entityId: uuid("entity_id"),
    entityType: text("entity_type"),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("activity_user_created_idx").on(t.userId, t.createdAt.desc())],
);

export const aiTaskEnum = pgEnum("ai_task", [
  "rewrite_bullet",
  "tailor_resume",
  "gap_analysis",
  "cover_letter",
  "interview_questions",
  "mock_interview",
  "jd_extract",
  "summarize",
  "company_research",
]);

/**
 * Audit trail for every model call: what was asked, what came back, how much it
 * cost. Powers per-user quotas and lets any AI suggestion be traced later.
 */
export const aiRuns = pgTable(
  "ai_run",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    applicationId: uuid("application_id").references(() => applications.id, {
      onDelete: "set null",
    }),

    task: aiTaskEnum("task").notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    status: text("status", { enum: ["success", "error", "refused"] })
      .notNull()
      .default("success"),

    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    costUsd: numeric("cost_usd", { precision: 10, scale: 6 })
      .notNull()
      .default("0"),
    durationMs: integer("duration_ms").notNull().default(0),

    /** Trimmed prompt/response kept for debugging and user transparency. */
    prompt: text("prompt"),
    result: jsonb("result").$type<unknown>(),
    error: text("error"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("ai_run_user_created_idx").on(t.userId, t.createdAt.desc()),
    index("ai_run_user_task_idx").on(t.userId, t.task),
  ],
);

/**
 * Saved job-description analyses that are not yet tied to an application, so
 * exploratory research is not lost.
 */
export const savedJobDescriptions = pgTable(
  "saved_job_description",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("Untitled posting"),
    company: text("company"),
    sourceUrl: text("source_url"),
    content: text("content").notNull(),
    analysis: jsonb("analysis").$type<unknown>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("saved_jd_user_idx").on(t.userId, t.createdAt.desc())],
);

/**
 * Idempotency + delivery record for scheduled notifications, so a retried cron
 * run never emails the same reminder twice.
 */
export const notifications = pgTable(
  "notification",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    channel: text("channel", { enum: ["email", "inapp"] })
      .notNull()
      .default("inapp"),
    kind: text("kind").notNull(),
    /** Stable key such as `follow-up:<appId>:2026-09-02`. */
    dedupeKey: text("dedupe_key").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    href: text("href"),
    readAt: timestamp("read_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("notification_user_idx").on(t.userId, t.createdAt.desc()),
    uniqueIndex("notification_dedupe_idx").on(t.userId, t.dedupeKey),
  ],
);

export const activityLogRelations = relations(activityLog, ({ one }) => ({
  user: one(users, { fields: [activityLog.userId], references: [users.id] }),
}));

export const aiRunsRelations = relations(aiRuns, ({ one }) => ({
  user: one(users, { fields: [aiRuns.userId], references: [users.id] }),
  application: one(applications, {
    fields: [aiRuns.applicationId],
    references: [applications.id],
  }),
}));

export type ActivityLogEntry = typeof activityLog.$inferSelect;
export type AiRun = typeof aiRuns.$inferSelect;
export type SavedJobDescription = typeof savedJobDescriptions.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
