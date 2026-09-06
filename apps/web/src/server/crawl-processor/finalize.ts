import { db } from "@teachanything/db";
import { crawledPages } from "@teachanything/db/schema";
import { eq, sql } from "drizzle-orm";

export async function finalizeCrawlSource(
  crawlSourceId: string,
): Promise<void> {
  // Atomic check-and-update: only finalize if no pages are still in progress.
  // This prevents the race where two concurrent workers both see zero remaining
  // and both attempt to finalize, or worse, both skip finalization.
  const statusCounts = await db
    .select({
      status: crawledPages.status,
      count: sql<number>`count(*)`,
    })
    .from(crawledPages)
    .where(eq(crawledPages.crawlSourceId, crawlSourceId))
    .groupBy(crawledPages.status);

  const counts = Object.fromEntries(
    statusCounts.map((r) => [r.status, Number(r.count)]),
  );

  const pendingCount = (counts["pending"] ?? 0) + (counts["processing"] ?? 0);
  if (pendingCount > 0) return;

  const completedCount = (counts["completed"] ?? 0) + (counts["skipped"] ?? 0);
  const failedCount = (counts["failed"] ?? 0) + (counts["blocked"] ?? 0);

  // Use atomic UPDATE with NOT EXISTS to prevent race conditions:
  // only the last worker to finish will successfully update.
  await db.execute(sql`
    UPDATE crawl_sources
    SET status = 'completed',
        last_crawled_at = NOW(),
        metadata = COALESCE(metadata, '{}'::jsonb) || ${JSON.stringify({ pageCount: completedCount, errorCount: failedCount })}::jsonb,
        updated_at = NOW()
    WHERE id = ${crawlSourceId}
      AND status = 'crawling'
      AND NOT EXISTS (
        SELECT 1 FROM crawled_pages
        WHERE crawl_source_id = ${crawlSourceId}
          AND status IN ('pending', 'processing')
      )
  `);
}
