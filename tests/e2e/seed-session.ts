/**
 * Writes Playwright storageState for a throwaway Auth.js database session.
 */
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { config } from "dotenv";

config({ path: ".env.local" });
config();

const AUTH_FILE = "tests/e2e/.auth/user.json";

async function main() {
  const { db } = await import("../../src/server/db");
  const { sessions, users } = await import("../../src/server/db/schema");
  const { like } = await import("drizzle-orm");

  await db.delete(users).where(like(users.email, "e2e.ui.%@trackfolio.test"));

  const email = `e2e.ui.${Date.now()}@trackfolio.test`;
  const [user] = await db
    .insert(users)
    .values({ email, name: "E2E UI" })
    .returning({ id: users.id, email: users.email });
  if (!user) throw new Error("Could not insert UI test user.");

  const sessionToken = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await db.insert(sessions).values({
    sessionToken,
    userId: user.id,
    expires,
  });

  mkdirSync(dirname(AUTH_FILE), { recursive: true });
  writeFileSync(
    AUTH_FILE,
    JSON.stringify({
      cookies: [
        {
          name: "authjs.session-token",
          value: sessionToken,
          domain: "localhost",
          path: "/",
          httpOnly: true,
          secure: false,
          sameSite: "Lax",
          expires: Math.floor(expires.getTime() / 1000),
        },
      ],
      origins: [],
    }),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
