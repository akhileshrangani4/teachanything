import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const skipValidation = process.env.SKIP_ENV_VALIDATION === "1";

// Only throw error if DATABASE_URL is missing and we're not in CI mode
if (!process.env.DATABASE_URL && !skipValidation) {
  throw new Error("DATABASE_URL is not set");
}

// Use a dummy URL in CI mode if DATABASE_URL is not set
const databaseUrl =
  process.env.DATABASE_URL || "postgresql://ci:ci@localhost:5432/ci";

/**
 * `prepare: false` is required, not a tuning knob.
 *
 * Production connects through Supabase's pooler on port 6543, which is
 * TRANSACTION mode: a connection is handed to a different backend between
 * statements, so a prepared statement created on one is not there for the next.
 * postgres.js prepares any query it can infer is static, which is every
 * parameterized drizzle query, so this surfaces as intermittent
 * `Failed query: ...` on ordinary statements -- a chunk delete, a status update
 * -- depending on which backend the connection landed on.
 *
 * It does not reproduce locally: local development points at port 5432, which is
 * SESSION mode, where one backend serves a connection for its whole life and
 * prepared statements behave normally. Same code, same driver, different pooler.
 *
 * The `?pgbouncer=true` in the production URL does not help; that is a Prisma
 * parameter and postgres.js ignores it.
 *
 * `max` caps connections PER SERVERLESS INSTANCE. The default of 10 is a
 * per-instance figure that multiplies by every concurrent function, so it is
 * lowered here while leaving enough room that concurrent requests in one
 * instance are not serialized behind a single connection.
 */
const client = postgres(databaseUrl, {
  prepare: false,
  max: 5,
  idle_timeout: 20,
});
export const db = drizzle(client, { schema });
