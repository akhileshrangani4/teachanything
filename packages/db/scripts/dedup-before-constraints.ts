/**
 * Data Deduplication Script
 *
 * Removes duplicate rows from file_chunks and chatbot_file_associations
 * before unique constraints can be added. Duplicates exist due to a known
 * QStash retry bug that re-processes files without cleaning up first.
 *
 * Strategy: For each duplicate group, keep the row with the lowest ID
 * (earliest insert) and delete the rest using ROW_NUMBER() window function.
 *
 * Usage:
 *   npx tsx packages/db/scripts/dedup-before-constraints.ts
 *
 * Must be run BEFORE db:push when adding unique constraints.
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

async function dedup() {
  const sql = postgres(databaseUrl!);

  try {
    console.log("Counting duplicate groups before cleanup...\n");

    // Count duplicate file_chunks groups
    const [chunkDups] = await sql`
      SELECT count(*)::int AS count FROM (
        SELECT file_id, chunk_index
        FROM file_chunks
        GROUP BY file_id, chunk_index
        HAVING count(*) > 1
      ) sub
    `;

    // Count duplicate chatbot_file_associations groups
    const [assocDups] = await sql`
      SELECT count(*)::int AS count FROM (
        SELECT chatbot_id, file_id
        FROM chatbot_file_associations
        GROUP BY chatbot_id, file_id
        HAVING count(*) > 1
      ) sub
    `;

    console.log(`  file_chunks: ${chunkDups.count} duplicate group(s) found`);
    console.log(
      `  chatbot_file_associations: ${assocDups.count} duplicate group(s) found`,
    );

    // Delete duplicate file_chunks, keeping the row with the lowest id
    const chunkDeleted = await sql`
      DELETE FROM file_chunks WHERE id IN (
        SELECT id FROM (
          SELECT id, ROW_NUMBER() OVER (PARTITION BY file_id, chunk_index ORDER BY id ASC) AS rn
          FROM file_chunks
        ) ranked WHERE rn > 1
      )
    `;

    console.log(
      `\n  file_chunks: deleted ${chunkDeleted.count} duplicate row(s)`,
    );

    // Delete duplicate chatbot_file_associations, keeping the row with the lowest id
    const assocDeleted = await sql`
      DELETE FROM chatbot_file_associations WHERE id IN (
        SELECT id FROM (
          SELECT id, ROW_NUMBER() OVER (PARTITION BY chatbot_id, file_id ORDER BY id ASC) AS rn
          FROM chatbot_file_associations
        ) ranked WHERE rn > 1
      )
    `;

    console.log(
      `  chatbot_file_associations: deleted ${assocDeleted.count} duplicate row(s)`,
    );

    // Verify zero duplicates remain
    console.log("\nVerifying zero duplicates remain...");

    const [chunkVerify] = await sql`
      SELECT count(*)::int AS count FROM (
        SELECT file_id, chunk_index
        FROM file_chunks
        GROUP BY file_id, chunk_index
        HAVING count(*) > 1
      ) sub
    `;

    const [assocVerify] = await sql`
      SELECT count(*)::int AS count FROM (
        SELECT chatbot_id, file_id
        FROM chatbot_file_associations
        GROUP BY chatbot_id, file_id
        HAVING count(*) > 1
      ) sub
    `;

    if (chunkVerify.count > 0 || assocVerify.count > 0) {
      console.error(`Verification failed! Duplicates still remain:`);
      console.error(`  file_chunks: ${chunkVerify.count} duplicate group(s)`);
      console.error(
        `  chatbot_file_associations: ${assocVerify.count} duplicate group(s)`,
      );
      process.exit(1);
    }

    console.log("  All clear -- zero duplicates remain.");
    console.log("\nDeduplication complete.");
  } catch (error) {
    console.error("Error during deduplication:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

dedup();
