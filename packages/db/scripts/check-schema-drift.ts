/**
 * Fails when the database is missing a table or column that schema.ts
 * declares (see src/schema-drift.ts).
 *
 * The release workflow runs this after db:migrate and before merging into
 * the production branch, so a deploy never ships code that queries a column
 * the database does not have.
 *
 * Usage:
 *   npm run db:check-drift
 */

import postgres from "postgres";
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import * as schema from "../src/schema";
import {
  DB_COLUMNS_QUERY,
  collectDeclaredTables,
  diffSchema,
  formatDriftReport,
  type DbColumn,
} from "../src/schema-drift";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Same env loading as check-index-health.ts: apps/web/.env locally, the
// ambient environment in CI, where a missing file (ENOENT) is expected.
const result = config({ path: resolve(__dirname, "../../../apps/web/.env") });

if (result.error && (result.error as NodeJS.ErrnoException).code !== "ENOENT") {
  console.error("❌ Error loading .env file:", result.error);
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("❌ DATABASE_URL environment variable is not set");
  process.exit(1);
}

async function checkSchemaDrift() {
  // prepare: false because production goes through Supabase's transaction
  // pooler (see src/db.ts). The read-only transaction guarantees the check
  // cannot write, and keeps it on one backend connection.
  const sql = postgres(databaseUrl!, { prepare: false, max: 1 });

  try {
    const declared = collectDeclaredTables(schema);
    const dbColumns = await sql.begin("read only", (tx) =>
      tx.unsafe<DbColumn[]>(DB_COLUMNS_QUERY),
    );
    const report = formatDriftReport(diffSchema(declared, dbColumns));

    if (report) {
      console.error(`❌ ${report}`);
      process.exitCode = 1;
      return;
    }

    console.log(
      `✅ No schema drift: all ${declared.length} declared tables and their columns exist`,
    );
    for (const { table, columns } of declared) {
      console.log(`  - ${table} (${columns.length} columns)`);
    }
  } catch (error) {
    console.error("❌ Error checking schema drift:", error);
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}

checkSchemaDrift();
