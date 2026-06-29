/**
 * Database Extensions Setup Script
 *
 * This script enables required PostgreSQL extensions (currently: pgvector).
 * It reads the SQL from ./setup-extensions.sql and executes it.
 *
 * Usage:
 *   npm run db:setup-extensions
 *
 * This script is automatically run before db:push and db:migrate commands.
 */

import postgres from "postgres";
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from apps/web/.env when present. In CI (e.g. the
// release deploy) that file doesn't exist and DATABASE_URL comes from the
// ambient environment. A missing file (ENOENT) is therefore expected and
// tolerated, but any other load error (permissions, malformed file) is a real
// problem and still fails fast.
const envPath = resolve(__dirname, "../../../apps/web/.env");
const result = config({ path: envPath });

if (result.error && (result.error as NodeJS.ErrnoException).code !== "ENOENT") {
  console.error("❌ Error loading .env file:", result.error);
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("❌ DATABASE_URL environment variable is not set");
  process.exit(1);
}

async function setupExtensions() {
  const sql = postgres(databaseUrl!);

  try {
    console.log("🔧 Enabling required database extensions...");

    // Read the SQL file from the same directory
    const sqlContent = readFileSync(
      resolve(__dirname, "./setup-extensions.sql"),
      "utf-8",
    );

    // Execute statements one at a time. Sending the whole file as a single
    // multi-statement simple query makes Postgres wrap it in an implicit
    // transaction block, which breaks `CREATE INDEX CONCURRENTLY` ("cannot run
    // inside a transaction block"). Running each statement on its own keeps it
    // auto-committed so CONCURRENTLY is allowed. Chunks that are only comments
    // (e.g. trailing) are skipped.
    const statements = sqlContent
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.replace(/--[^\n]*/g, "").trim().length > 0);

    for (const statement of statements) {
      await sql.unsafe(statement);
    }

    console.log("✅ Database extensions enabled successfully");
  } catch (error) {
    console.error("❌ Error enabling extensions:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

setupExtensions();
