import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import type { AdapterAccountType } from "next-auth/adapters";

/**
 * Auth.js core tables. Column names follow the shapes expected by
 * `@auth/drizzle-adapter`; renaming them will break the adapter.
 */

export const users = pgTable(
  "user",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name"),
    email: text("email").notNull(),
    emailVerified: timestamp("emailVerified", { mode: "date", withTimezone: true }),
    image: text("image"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    // Soft-delete so a deletion request can be honoured without cascading
    // destruction of audit history.
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("user_email_unique").on(t.email)],
);

export const accounts = pgTable(
  "account",
  {
    userId: uuid("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [
    primaryKey({ columns: [t.provider, t.providerAccountId] }),
    index("account_user_id_idx").on(t.userId),
  ],
);

export const sessions = pgTable(
  "session",
  {
    sessionToken: text("sessionToken").primaryKey(),
    userId: uuid("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expires: timestamp("expires", { mode: "date", withTimezone: true }).notNull(),
  },
  (t) => [index("session_user_id_idx").on(t.userId)],
);

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date", withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

export const authenticators = pgTable(
  "authenticator",
  {
    credentialID: text("credentialID").notNull().unique(),
    userId: uuid("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    providerAccountId: text("providerAccountId").notNull(),
    credentialPublicKey: text("credentialPublicKey").notNull(),
    counter: integer("counter").notNull(),
    credentialDeviceType: text("credentialDeviceType").notNull(),
    credentialBackedUp: boolean("credentialBackedUp").notNull(),
    transports: text("transports"),
  },
  (t) => [primaryKey({ columns: [t.userId, t.credentialID] })],
);

/**
 * Application-level user preferences, kept separate from the Auth.js `user`
 * table so adapter upgrades never collide with product columns.
 */
export const userProfiles = pgTable(
  "user_profile",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),

    // Identity used when generating documents and export filenames.
    fullName: text("full_name"),
    headline: text("headline"),
    location: text("location"),
    phone: text("phone"),
    websiteUrl: text("website_url"),
    linkedinUrl: text("linkedin_url"),
    githubUrl: text("github_url"),

    theme: text("theme", { enum: ["light", "dark", "system"] })
      .notNull()
      .default("system"),
    accent: text("accent").notNull().default("indigo"),
    timezone: text("timezone").notNull().default("UTC"),

    // Number of days without a status change before an application is "stale".
    staleAfterDays: integer("stale_after_days").notNull().default(14),
    defaultTexEngine: text("default_tex_engine", {
      enum: ["pdflatex", "xelatex", "lualatex"],
    })
      .notNull()
      .default("pdflatex"),
    autoCompile: boolean("auto_compile").notNull().default(false),

    // Weekly digest email opt-in.
    digestEnabled: boolean("digest_enabled").notNull().default(true),
    digestDay: integer("digest_day").notNull().default(1), // 0=Sun … 6=Sat

    onboardedAt: timestamp("onboarded_at", { withTimezone: true }),

    // Bring-your-own-key AI credentials, encrypted at rest.
    aiProvider: text("ai_provider", { enum: ["openai", "anthropic", "platform"] })
      .notNull()
      .default("platform"),
    encryptedAiKey: text("encrypted_ai_key"),

    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
);

export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(userProfiles, {
    fields: [users.id],
    references: [userProfiles.userId],
  }),
  accounts: many(accounts),
  sessions: many(sessions),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const userProfilesRelations = relations(userProfiles, ({ one }) => ({
  user: one(users, { fields: [userProfiles.userId], references: [users.id] }),
}));

export type User = typeof users.$inferSelect;
export type UserProfile = typeof userProfiles.$inferSelect;
export type NewUserProfile = typeof userProfiles.$inferInsert;
