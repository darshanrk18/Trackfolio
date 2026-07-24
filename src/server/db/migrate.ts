/**
 * Schema sync helper. SQL migrations live in ./drizzle once generated.
 *
 *   pnpm db:generate   — emit SQL from schema changes
 *   pnpm db:migrate    — apply them (this file)
 *   pnpm db:push       — push schema without a migration folder (dev)
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { config } from "dotenv";

config({ path: ".env.local" });
config();

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const sql = postgres(url, { max: 1 });
const db = drizzle(sql);

async function main() {
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations applied.");
  await sql.end({ timeout: 5 });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
