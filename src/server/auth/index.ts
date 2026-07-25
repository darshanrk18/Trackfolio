import NextAuth from "next-auth";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { authConfig } from "./config";
import { db } from "@/server/db";
import { userProfiles } from "@/server/db/schema";

const { auth: uncachedAuth, handlers, signIn, signOut } = NextAuth(authConfig);

/**
 * Request-scoped session lookup. `cache` dedupes the call so a page rendering
 * a layout, a header and three server components performs one session read.
 */
export const auth = cache(uncachedAuth);

export { handlers, signIn, signOut };

export type SessionUser = {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
};

/** Returns the signed-in user, or null. */
export async function currentUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) return null;
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    image: session.user.image,
  };
}

/** Throws when unauthenticated. Use in server actions and route handlers. */
export async function requireUser(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}

/**
 * Ensures a profile row exists for the user, creating it on first access.
 * Safe to call concurrently — the insert is idempotent on the primary key.
 */
export async function ensureProfile(userId: string) {
  const existing = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.userId, userId),
  });
  if (existing) return existing;

  const [created] = await db
    .insert(userProfiles)
    .values({ userId })
    .onConflictDoNothing({ target: userProfiles.userId })
    .returning();

  return (
    created ??
    (await db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, userId),
    }))!
  );
}
