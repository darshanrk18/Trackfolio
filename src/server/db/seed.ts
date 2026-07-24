/**
 * Optional demo seed. Requires an existing user id (copy from the Auth.js
 * `user` table after first sign-in).
 *
 *   USER_ID=... pnpm db:seed
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config();

async function main() {
  const { eq } = await import("drizzle-orm");
  const { db } = await import("./index");
  const { branches, users } = await import("./schema");

  const userId = process.env.USER_ID;
  if (!userId) {
    console.log("Set USER_ID to seed a demo master branch for that account.");
    return;
  }

  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) {
    console.error("No user with that id.");
    process.exitCode = 1;
    return;
  }

  const existing = await db.query.branches.findFirst({
    where: eq(branches.userId, userId),
  });
  if (existing) {
    console.log("User already has branches; skipping.");
    return;
  }

  await db.insert(branches).values({
    userId,
    kind: "resume",
    name: "Master Resume",
    isMaster: true,
    profile: "general",
    content: "",
  });
  console.log("Created empty master resume branch.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
