import { relations, sql } from "drizzle-orm";
import {
  boolean,
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

export const documentKindEnum = pgEnum("document_kind", [
  "resume",
  "cover_letter",
]);

export const documentFormatEnum = pgEnum("document_format", [
  "latex",
  "markdown",
  "plaintext",
]);

/**
 * Role archetypes used to tailor guidance and to segment conversion analytics.
 */
export const roleProfileEnum = pgEnum("role_profile", [
  "general",
  "backend",
  "frontend",
  "fullstack",
  "cloud",
  "data",
  "ml",
  "mobile",
  "security",
  "sre",
]);

/**
 * A branch is a mutable working copy of a document, modelled on git.
 *
 * Exactly one branch per (user, kind) is the protected master. Tailored
 * branches record the branch and version they were cut from, so the lineage of
 * any submitted document is always reconstructible.
 */
export const branches = pgTable(
  "branch",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    kind: documentKindEnum("kind").notNull().default("resume"),
    format: documentFormatEnum("format").notNull().default("latex"),

    name: text("name").notNull(),
    company: text("company"),
    role: text("role"),
    profile: roleProfileEnum("profile").notNull().default("general"),

    isMaster: boolean("is_master").notNull().default(false),
    isArchived: boolean("is_archived").notNull().default(false),

    parentBranchId: uuid("parent_branch_id"),
    parentVersionId: uuid("parent_version_id"),

    /** Live working content. Committed snapshots live in `documentVersions`. */
    content: text("content").notNull().default(""),
    /** SHA-256 of `content`, used to skip redundant compiles and no-op commits. */
    contentHash: text("content_hash"),

    lastVersionId: uuid("last_version_id"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("branch_user_kind_idx").on(t.userId, t.kind),
    index("branch_user_updated_idx").on(t.userId, t.updatedAt.desc()),
    // At most one master branch per document kind per user.
    uniqueIndex("branch_one_master_per_kind")
      .on(t.userId, t.kind)
      .where(sql`${t.isMaster} = true`),
  ],
);

/**
 * Immutable committed snapshot of a document. Never updated after insert —
 * the whole product promise is that a submitted document can always be
 * reproduced byte-for-byte.
 */
export const documentVersions = pgTable(
  "document_version",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    kind: documentKindEnum("kind").notNull().default("resume"),
    format: documentFormatEnum("format").notNull().default("latex"),

    branchId: uuid("branch_id").references(() => branches.id, {
      onDelete: "set null",
    }),
    branchName: text("branch_name"),
    parentVersionId: uuid("parent_version_id"),

    /** Monotonic per-branch counter, so versions read as v1, v2, v3… */
    revision: integer("revision").notNull().default(1),

    note: text("note").notNull().default(""),
    content: text("content").notNull(),
    contentHash: text("content_hash").notNull(),

    profile: roleProfileEnum("profile").notNull().default("general"),
    company: text("company"),
    role: text("role"),

    /** Cached output of the deterministic analysis engine at commit time. */
    stats: jsonb("stats")
      .$type<{
        wordCount: number;
        bulletCount: number;
        healthScore: number;
        quantifiedPct: number;
        actionVerbPct: number;
      } | null>()
      .default(sql`null`),

    /** Compiled PDF, when one has been produced for this exact content. */
    pdfUrl: text("pdf_url"),
    pdfBytes: integer("pdf_bytes"),
    pdfPages: integer("pdf_pages"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("version_user_kind_created_idx").on(
      t.userId,
      t.kind,
      t.createdAt.desc(),
    ),
    index("version_branch_idx").on(t.branchId, t.revision.desc()),
    index("version_hash_idx").on(t.userId, t.contentHash),
  ],
);

/**
 * Keyword guardrails: terms that must never silently disappear from a resume
 * while it is being tailored.
 */
export const watchTerms = pgTable(
  "watch_term",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    term: text("term").notNull(),
    /** Optional scoping: a term that only matters for one role archetype. */
    profile: roleProfileEnum("profile"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("watch_term_unique").on(t.userId, sql`lower(${t.term})`),
    index("watch_term_user_idx").on(t.userId),
  ],
);

/**
 * Cache of LaTeX compilations keyed by content hash + engine, so recompiling an
 * unchanged document is free and never re-hits the upstream compiler.
 */
export const compilations = pgTable(
  "compilation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    contentHash: text("content_hash").notNull(),
    engine: text("engine", { enum: ["pdflatex", "xelatex", "lualatex"] })
      .notNull()
      .default("pdflatex"),
    status: text("status", { enum: ["success", "error"] }).notNull(),
    pdfUrl: text("pdf_url"),
    bytes: integer("bytes"),
    pages: integer("pages"),
    durationMs: integer("duration_ms"),
    log: text("log"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("compilation_hash_engine_unique").on(
      t.userId,
      t.contentHash,
      t.engine,
    ),
    index("compilation_user_created_idx").on(t.userId, t.createdAt.desc()),
  ],
);

export const branchesRelations = relations(branches, ({ one, many }) => ({
  user: one(users, { fields: [branches.userId], references: [users.id] }),
  parent: one(branches, {
    fields: [branches.parentBranchId],
    references: [branches.id],
    relationName: "branch_lineage",
  }),
  children: many(branches, { relationName: "branch_lineage" }),
  versions: many(documentVersions),
}));

export const documentVersionsRelations = relations(
  documentVersions,
  ({ one }) => ({
    user: one(users, {
      fields: [documentVersions.userId],
      references: [users.id],
    }),
    branch: one(branches, {
      fields: [documentVersions.branchId],
      references: [branches.id],
    }),
  }),
);

export type Branch = typeof branches.$inferSelect;
export type NewBranch = typeof branches.$inferInsert;
export type DocumentVersion = typeof documentVersions.$inferSelect;
export type NewDocumentVersion = typeof documentVersions.$inferInsert;
export type WatchTerm = typeof watchTerms.$inferSelect;
export type Compilation = typeof compilations.$inferSelect;
export type RoleProfile = (typeof roleProfileEnum.enumValues)[number];
export type DocumentKind = (typeof documentKindEnum.enumValues)[number];
export type TexEngine = "pdflatex" | "xelatex" | "lualatex";
