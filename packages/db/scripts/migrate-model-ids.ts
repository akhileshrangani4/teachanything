/**
 * Model ID Migration Script
 *
 * Updates chatbots that reference deprecated model IDs to use their
 * current replacements. This is a one-time data migration that can be
 * safely re-run (idempotent) -- if no rows match the old IDs, zero
 * rows are updated.
 *
 * Mapping (kept in sync with DEPRECATED_MODEL_MAP in packages/ai/src/models.ts):
 *   qwen/qwen3-235b-a22b          -> qwen/qwen3-235b-a22b-2507
 *   qwen/qwen-2.5-72b-instruct    -> qwen/qwen3-235b-a22b-2507
 *   mistralai/mistral-large       -> meta-llama/llama-3.3-70b-instruct
 *   mistralai/mistral-large-2411  -> meta-llama/llama-3.3-70b-instruct  (retired from OpenRouter)
 *   google/gemma-4-31b-it         -> meta-llama/llama-3.3-70b-instruct  (unreliable tool-calling)
 *
 * Usage:
 *   npx tsx packages/db/scripts/migrate-model-ids.ts
 */

import postgres from "postgres";
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from apps/web/.env
const envPath = resolve(__dirname, "../../../apps/web/.env");
const result = config({ path: envPath });

if (result.error) {
  console.error("Error loading .env file:", result.error);
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL environment variable is not set");
  process.exit(1);
}

// Inline mapping (self-contained -- no build dependency on models.ts)
const MODEL_MIGRATIONS: Record<string, string> = {
  "qwen/qwen3-235b-a22b": "qwen/qwen3-235b-a22b-2507",
  "qwen/qwen-2.5-72b-instruct": "qwen/qwen3-235b-a22b-2507",
  "mistralai/mistral-large": "meta-llama/llama-3.3-70b-instruct",
  "mistralai/mistral-large-2411": "meta-llama/llama-3.3-70b-instruct",
  "google/gemma-4-31b-it": "meta-llama/llama-3.3-70b-instruct",
};

async function migrate() {
  const sql = postgres(databaseUrl!);

  try {
    console.log("Migrating deprecated model IDs in chatbots table...\n");

    for (const [oldId, newId] of Object.entries(MODEL_MIGRATIONS)) {
      const updated = await sql`
        UPDATE chatbots
        SET model = ${newId}, updated_at = NOW()
        WHERE model = ${oldId}
      `;
      console.log(
        `  ${oldId} -> ${newId}: ${updated.count} chatbot(s) updated`,
      );
    }

    // Verify no old IDs remain
    console.log("\nVerifying no deprecated model IDs remain...");

    let hasRemaining = false;
    for (const oldId of Object.keys(MODEL_MIGRATIONS)) {
      const [row] = await sql`
        SELECT count(*)::int AS count FROM chatbots WHERE model = ${oldId}
      `;
      if (row.count > 0) {
        console.error(
          `  ERROR: ${row.count} chatbot(s) still have model = '${oldId}'`,
        );
        hasRemaining = true;
      }
    }

    if (hasRemaining) {
      console.error("\nVerification failed! Old model IDs still exist.");
      process.exit(1);
    }

    console.log("  All clear -- no deprecated model IDs remain.");
    console.log("\nMigration complete.");
  } catch (error) {
    console.error("Error during model ID migration:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

migrate();
