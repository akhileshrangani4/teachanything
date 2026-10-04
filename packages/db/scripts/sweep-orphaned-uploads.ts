/**
 * Deletes uploaded files that no user_files row points at (see
 * src/orphaned-uploads.ts for how they come about).
 *
 * Reports only, unless --apply is passed. Deletion goes through the Storage
 * API, never `DELETE FROM storage.objects`, which would drop the metadata row
 * and leave the file itself behind.
 *
 * Deliberately NOT part of db:migrate: a deploy must never delete files.
 *
 * Usage (from packages/db):
 *   npm run db:sweep-orphaned-uploads              # report only
 *   npm run db:sweep-orphaned-uploads -- --apply   # delete
 */

import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import {
  ORPHANED_UPLOADS_QUERY,
  REMOVE_BATCH_SIZE,
  UPLOAD_BUCKET,
  chunk,
  formatOrphanReport,
  type OrphanedUpload,
} from "../src/orphaned-uploads";

const __dirname = dirname(fileURLToPath(import.meta.url));

const result = config({ path: resolve(__dirname, "../../../apps/web/.env") });

if (result.error) {
  console.error("❌ Error loading .env file:", result.error);
  process.exit(1);
}

const isApply = process.argv.includes("--apply");

const databaseUrl = process.env.DATABASE_URL;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!databaseUrl || (isApply && (!supabaseUrl || !serviceRoleKey))) {
  console.error(
    isApply
      ? "❌ DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set"
      : "❌ DATABASE_URL must be set",
  );
  process.exit(1);
}

async function findOrphans(): Promise<OrphanedUpload[]> {
  const sql = postgres(databaseUrl!, { max: 1, prepare: false });
  try {
    const rows = await sql.unsafe<
      { path: string; size: string; createdAt: Date }[]
    >(ORPHANED_UPLOADS_QUERY);
    return rows.map((r) => ({ ...r, size: Number(r.size) }));
  } finally {
    await sql.end();
  }
}

async function removeOrphans(orphans: OrphanedUpload[]): Promise<number> {
  const storage = createClient(supabaseUrl!, serviceRoleKey!, {
    auth: { persistSession: false },
  }).storage.from(UPLOAD_BUCKET);

  let removed = 0;
  for (const batch of chunk(orphans, REMOVE_BATCH_SIZE)) {
    const { data, error } = await storage.remove(batch.map((o) => o.path));
    if (error) throw error;
    removed += data.length;
    console.log(`  removed ${removed}/${orphans.length}`);
  }
  return removed;
}

async function main() {
  const orphans = await findOrphans();
  console.log(formatOrphanReport(orphans));

  if (!isApply) {
    console.log("\nReport only. Re-run with --apply to delete these files.");
    return;
  }
  if (orphans.length === 0) return;

  const removed = await removeOrphans(orphans);
  if (removed !== orphans.length) {
    console.error(
      `⚠️  Storage reported ${removed} deletions for ${orphans.length} paths.`,
    );
    process.exit(1);
  }
  console.log(`✅ Deleted ${removed} orphaned uploads.`);
}

main().catch((error) => {
  console.error("❌ Sweep failed:", error);
  process.exit(1);
});
