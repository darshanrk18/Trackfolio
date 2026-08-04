import { eq, inArray } from "drizzle-orm";
import {
  activityLog,
  aiRuns,
  applicationContacts,
  applicationEvents,
  applications,
  branches,
  compilations,
  contacts,
  documentVersions,
  notifications,
  savedJobDescriptions,
  watchTerms,
} from "@/server/db/schema";
import type { txClient } from "@/server/db";

export type TransactionClient = Parameters<
  Parameters<ReturnType<typeof txClient>["transaction"]>[0]
>[0];

/**
 * Deletes every content row owned by `userId`. Ordered so foreign keys go
 * first. Does not touch the Auth.js identity tables.
 */
export async function purgeUserContent(
  tx: TransactionClient,
  userId: string,
): Promise<void> {
  const ownedApplications = await tx
    .select({ id: applications.id })
    .from(applications)
    .where(eq(applications.userId, userId));
  const ownedContacts = await tx
    .select({ id: contacts.id })
    .from(contacts)
    .where(eq(contacts.userId, userId));

  if (ownedApplications.length > 0) {
    await tx.delete(applicationContacts).where(
      inArray(
        applicationContacts.applicationId,
        ownedApplications.map((a) => a.id),
      ),
    );
  }
  if (ownedContacts.length > 0) {
    await tx.delete(applicationContacts).where(
      inArray(
        applicationContacts.contactId,
        ownedContacts.map((c) => c.id),
      ),
    );
  }

  await tx.delete(applicationEvents).where(eq(applicationEvents.userId, userId));
  await tx.delete(applications).where(eq(applications.userId, userId));
  await tx.delete(contacts).where(eq(contacts.userId, userId));
  await tx.delete(documentVersions).where(eq(documentVersions.userId, userId));
  await tx.delete(branches).where(eq(branches.userId, userId));
  await tx.delete(watchTerms).where(eq(watchTerms.userId, userId));
  await tx.delete(compilations).where(eq(compilations.userId, userId));
  await tx
    .delete(savedJobDescriptions)
    .where(eq(savedJobDescriptions.userId, userId));
  await tx.delete(aiRuns).where(eq(aiRuns.userId, userId));
  await tx.delete(notifications).where(eq(notifications.userId, userId));
  await tx.delete(activityLog).where(eq(activityLog.userId, userId));
}
