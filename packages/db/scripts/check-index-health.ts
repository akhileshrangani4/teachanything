/**
 * Fails when any index in `public` is invalid (see src/index-health.ts).
 *
 * Runs after migrations in db:migrate and db:push, so the release workflow
 * stops before deploying instead of shipping with a silently broken index.
 *
 * Usage:
 *   npm run db:check-indexes
 */

import postgres from "postgres";
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import {
  INVALID_INDEXES_QUERY,
  formatInvalidIndexReport,
  type InvalidIndex,
} from "../src/index-health";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Same env loading as setup-extensions.ts: apps/web/.env locally, the ambient
// environment in CI, where a missing file (ENOENT) is expected.
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

async function checkIndexHealth() {
  const sql = postgres(databaseUrl!);

  try {
    const invalid = await sql.unsafe<InvalidIndex[]>(INVALID_INDEXES_QUERY);
    const report = formatInvalidIndexReport(invalid);

    if (report) {
      console.error(`❌ ${report}`);
      process.exitCode = 1;
      return;
    }

    console.log("✅ All indexes are valid");
  } catch (error) {
    console.error("❌ Error checking index health:", error);
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}

checkIndexHealth();
