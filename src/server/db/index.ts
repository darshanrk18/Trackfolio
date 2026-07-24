import { neon, neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle as drizzleHttp } from "drizzle-orm/neon-http";
import { drizzle as drizzleServerless } from "drizzle-orm/neon-serverless";
import { env } from "@/env";
import * as schema from "./schema";

/**
 * Two Neon drivers, chosen per workload:
 *
 * - `db` uses neon-http: one round trip per query, ideal for serverless request
 *   handlers that run a handful of independent reads.
 * - `txDb` uses the WebSocket pool, which is the only way to get real
 *   multi-statement transactions on Neon.
 *
 * Both are cached on `globalThis` in development so Next.js hot reloads do not
 * leak connections.
 */

neonConfig.fetchConnectionCache = true;

const globalForDb = globalThis as unknown as {
  __trackfolioDb?: ReturnType<typeof createHttpClient>;
  __trackfolioPool?: Pool;
};

function createHttpClient() {
  const sql = neon(env.DATABASE_URL);
  return drizzleHttp(sql, {
    schema,
    logger: env.NODE_ENV === "development" ? false : false,
  });
}

export const db = globalForDb.__trackfolioDb ?? createHttpClient();
if (env.NODE_ENV !== "production") globalForDb.__trackfolioDb = db;

function getPool(): Pool {
  const pool = globalForDb.__trackfolioPool ?? new Pool({ connectionString: env.DATABASE_URL });
  if (env.NODE_ENV !== "production") globalForDb.__trackfolioPool = pool;
  return pool;
}

/**
 * Transactional client. Use for any multi-write operation that must be atomic,
 * e.g. committing a version while advancing a branch pointer.
 */
export function txClient() {
  return drizzleServerless(getPool(), { schema });
}

export type Database = typeof db;
export type Schema = typeof schema;
export { schema };
