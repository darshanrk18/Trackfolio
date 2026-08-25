import { NextResponse } from "next/server";
import { and, isNull, lte, or, sql } from "drizzle-orm";
import { env } from "@/env";
import { db } from "@/server/db";
import { applications, contacts, notifications } from "@/server/db/schema";
import { logger } from "@/server/lib/logger";

/**
 * Daily reminder pass. Vercel Cron hits this with `Authorization: Bearer $CRON_SECRET`.
 * Idempotent via `notifications.dedupeKey`.
 */
export async function GET(request: Request) {
  const secret = env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date().toISOString().slice(0, 10);
  let created = 0;

  const dueApps = await db.query.applications.findMany({
    where: and(
      isNull(applications.archivedAt),
      lte(applications.followUpOn, today),
    ),
    columns: {
      id: true,
      userId: true,
      company: true,
      role: true,
      followUpOn: true,
    },
    limit: 500,
  });

  for (const app of dueApps) {
    const key = `follow-up:${app.id}:${app.followUpOn}`;
    const inserted = await db
      .insert(notifications)
      .values({
        userId: app.userId,
        channel: "inapp",
        kind: "follow_up",
        dedupeKey: key,
        title: `Follow up with ${app.company}`,
        body: app.role || null,
        href: `/applications/${app.id}`,
      })
      .onConflictDoNothing()
      .returning({ id: notifications.id });
    created += inserted.length;
  }

  const dueContacts = await db.query.contacts.findMany({
    where: or(
      and(sql`${contacts.nextTouchOn} is not null`, lte(contacts.nextTouchOn, today)),
      and(
        sql`${contacts.cadenceDays} is not null`,
        sql`${contacts.lastContactedOn} is not null`,
        sql`${contacts.lastContactedOn} + ${contacts.cadenceDays} <= current_date`,
      ),
    ),
    columns: { id: true, userId: true, name: true, company: true },
    limit: 500,
  });

  for (const contact of dueContacts) {
    const key = `contact:${contact.id}:${today}`;
    const inserted = await db
      .insert(notifications)
      .values({
        userId: contact.userId,
        channel: "inapp",
        kind: "contact",
        dedupeKey: key,
        title: `Reach out to ${contact.name}`,
        body: contact.company,
        href: `/contacts?id=${contact.id}`,
      })
      .onConflictDoNothing()
      .returning({ id: notifications.id });
    created += inserted.length;
  }

  logger.info({ created, day: today }, "cron reminders");
  return NextResponse.json({ ok: true, created });
}
