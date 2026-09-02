import type { db as database } from "@teachanything/db";
import { crawlSources, crawledPages } from "@teachanything/db/schema";
import { and, eq, inArray, lt, or, sql } from "drizzle-orm";
import { logInfo, logError } from "@/lib/logger";
import {
  mergeCrawledPageMetadata,
  mergeCrawlSourceMetadata,
} from "./crawler-metadata-sql";

/**
 * A source sitting in `pending`/`discovering` for longer than this has lost its
 * worker. Discovery itself is capped well under 5 minutes (see
 * DISCOVERY_TIMEOUT_MS in crawl-processor.ts), so 15 minutes is generous.
 */
export const STALE_PRE_CRAWL_MS = 15 * 60 * 1000;

/**
 * A source in `crawling` is judged by page activity, not by its own
 * `updatedAt` -- the source row only changes on status transitions, and a large
 * crawl legitimately runs for a long while. If no page under it has been
 * touched in this long, the page workers are gone.
 */
export const STALE_CRAWL_MS = 30 * 60 * 1000;

const IN_PROGRESS_STATUSES = ["pending", "discovering", "crawling"] as const;

export const STALE_PRE_CRAWL_ERROR =
  "The crawl never started. It may have been interrupted -- try adding this source again.";

export const STALE_CRAWL_ERROR =
  "The crawl stopped responding and was timed out. Remove this source and try again, or lower the crawl depth.";

/**
 * True when a source that never reached `crawling` has gone quiet long enough
 * that its worker is presumed dead.
 */
export function isStalePreCrawl(params: {
  status: string;
  updatedAt: Date;
  now: Date;
}): boolean {
  const { status, updatedAt, now } = params;
  if (status !== "pending" && status !== "discovering") return false;
  return now.getTime() - updatedAt.getTime() > STALE_PRE_CRAWL_MS;
}

/**
 * True when a `crawling` source has seen no page activity recently.
 * `lastPageActivityAt` is null when discovery inserted no pages at all, in
 * which case the source's own `updatedAt` is the last sign of life.
 */
export function isStaleCrawl(params: {
  status: string;
  lastPageActivityAt: Date | null;
  updatedAt: Date;
  now: Date;
}): boolean {
  const { status, lastPageActivityAt, updatedAt, now } = params;
  if (status !== "crawling") return false;
  const lastActivity = lastPageActivityAt ?? updatedAt;
  return now.getTime() - lastActivity.getTime() > STALE_CRAWL_MS;
}

/**
 * Mark abandoned crawls as failed so they stop showing a spinner forever and
 * the user can delete or retry them.
 *
 * Workers can die without ever writing a terminal status -- a function killed
 * at its duration limit, an OOM, a deploy mid-crawl -- so recovery has to be
 * driven from stored state rather than from an in-process timeout. This runs
 * opportunistically on the list reads: cheap, and it self-heals the moment the
 * owner next opens the page.
 *
 * Never throws; a failed sweep must not break the read that triggered it.
 */
export async function sweepStaleCrawls(params: {
  db: typeof database;
  userId: string;
  now?: Date;
}): Promise<void> {
  const { db, userId, now = new Date() } = params;

  const preCrawlCutoff = new Date(now.getTime() - STALE_PRE_CRAWL_MS);
  const crawlCutoff = new Date(now.getTime() - STALE_CRAWL_MS);

  try {
    // Narrow to plausible candidates in SQL. These reads sit behind a 3s poll
    // while a crawl is running, so the usual answer must be "no rows" without
    // running the page-activity subquery. Filtering `crawling` on the source's
    // own timestamp is sound in that direction: pages are inserted as the
    // source flips to `crawling`, so page activity is never older than the
    // transition, and a recent transition cannot hide a stale crawl.
    const candidates = await db
      .select({
        id: crawlSources.id,
        status: crawlSources.status,
        updatedAt: crawlSources.updatedAt,
      })
      .from(crawlSources)
      .where(
        and(
          eq(crawlSources.userId, userId),
          or(
            and(
              inArray(crawlSources.status, ["pending", "discovering"]),
              lt(crawlSources.updatedAt, preCrawlCutoff),
            ),
            and(
              eq(crawlSources.status, "crawling"),
              lt(crawlSources.updatedAt, crawlCutoff),
            ),
          ),
        ),
      );

    if (candidates.length === 0) return;

    const stalePreCrawl = candidates.filter((source) =>
      isStalePreCrawl({
        status: source.status,
        updatedAt: source.updatedAt,
        now,
      }),
    );

    // Page activity for the crawling candidates only. A grouped query rather
    // than a correlated subquery: `crawled_pages` has its own `id`, so a
    // hand-written `WHERE crawl_source_id = id` silently compares two columns
    // of the same table and yields NULL for every row -- which would read as
    // "no activity" and reap crawls that are working fine.
    const crawlingCandidates = candidates.filter(
      (source) => source.status === "crawling",
    );

    const activity = new Map<string, Date>();
    if (crawlingCandidates.length > 0) {
      const rows = await db
        .select({
          crawlSourceId: crawledPages.crawlSourceId,
          lastActivityAt: sql<Date>`max(${crawledPages.updatedAt})`,
        })
        .from(crawledPages)
        .where(
          inArray(
            crawledPages.crawlSourceId,
            crawlingCandidates.map((source) => source.id),
          ),
        )
        .groupBy(crawledPages.crawlSourceId);

      for (const row of rows) {
        activity.set(row.crawlSourceId, new Date(row.lastActivityAt));
      }
    }

    const staleCrawling = crawlingCandidates.filter((source) =>
      isStaleCrawl({
        status: source.status,
        lastPageActivityAt: activity.get(source.id) ?? null,
        updatedAt: source.updatedAt,
        now,
      }),
    );

    if (stalePreCrawl.length > 0) {
      await db
        .update(crawlSources)
        .set({
          status: "failed",
          metadata: mergeCrawlSourceMetadata({
            errorCount: 1,
            errors: [{ url: "discovery", error: STALE_PRE_CRAWL_ERROR }],
          }),
          updatedAt: now,
        })
        .where(
          and(
            inArray(
              crawlSources.id,
              stalePreCrawl.map((source) => source.id),
            ),
            inArray(crawlSources.status, ["pending", "discovering"]),
            lt(crawlSources.updatedAt, preCrawlCutoff),
          ),
        );
    }

    for (const source of staleCrawling) {
      await timeOutStuckCrawl({ db, crawlSourceId: source.id, now });
    }

    const reapedCount = stalePreCrawl.length + staleCrawling.length;
    if (reapedCount > 0) {
      logInfo("Timed out stale crawls", {
        userId,
        preCrawl: stalePreCrawl.length,
        crawling: staleCrawling.length,
      });
    }
  } catch (error) {
    logError(error, "Stale crawl sweep failed", { userId });
  }
}

/**
 * Close out a single stuck crawl: settle the source, then fail every page still
 * in flight. Lands on `completed` when some pages did make it through and
 * `failed` when none did, so the badge reflects what the user actually got.
 *
 * Shared by the stale sweep and the user-initiated stop.
 */
export async function timeOutStuckCrawl(params: {
  db: typeof database;
  crawlSourceId: string;
  now?: Date;
  pageError?: string;
  sourceError?: string;
}): Promise<void> {
  const {
    db,
    crawlSourceId,
    now = new Date(),
    pageError = "Crawl timed out before this page was processed.",
    sourceError = STALE_CRAWL_ERROR,
  } = params;

  const statusCounts = await db
    .select({
      status: crawledPages.status,
      count: sql<number>`count(*)`,
    })
    .from(crawledPages)
    .where(eq(crawledPages.crawlSourceId, crawlSourceId))
    .groupBy(crawledPages.status);

  const counts = Object.fromEntries(
    statusCounts.map((row) => [row.status, Number(row.count)]),
  );
  const completedCount = (counts["completed"] ?? 0) + (counts["skipped"] ?? 0);
  // Pages still in flight are about to be failed, so they are errors already.
  const failedCount =
    (counts["failed"] ?? 0) +
    (counts["blocked"] ?? 0) +
    (counts["pending"] ?? 0) +
    (counts["processing"] ?? 0);
  const hasContent = completedCount > 0;

  // Settle the source first, and only if it is still ours to settle. A crawl
  // that finished on its own, or a re-crawl the user started in the meantime,
  // must keep the status it earned rather than take this one.
  const settled = await db
    .update(crawlSources)
    .set({
      status: hasContent ? "completed" : "failed",
      ...(hasContent ? { lastCrawledAt: now } : {}),
      metadata: mergeCrawlSourceMetadata({
        pageCount: completedCount,
        errorCount: failedCount,
        errors: [{ url: "crawl", error: sourceError }],
      }),
      updatedAt: now,
    })
    .where(
      and(
        eq(crawlSources.id, crawlSourceId),
        inArray(crawlSources.status, [...IN_PROGRESS_STATUSES]),
      ),
    )
    .returning({ id: crawlSources.id });

  if (settled.length === 0) return;

  // Failing the pages second means a discovery transaction that committed while
  // we waited on the source row is covered too, rather than leaving its freshly
  // inserted pages pending under a source nothing will revisit.
  await db
    .update(crawledPages)
    .set({
      status: "failed",
      metadata: mergeCrawledPageMetadata({ error: pageError }),
      updatedAt: now,
    })
    .where(
      and(
        eq(crawledPages.crawlSourceId, crawlSourceId),
        inArray(crawledPages.status, ["pending", "processing"]),
      ),
    );
}
