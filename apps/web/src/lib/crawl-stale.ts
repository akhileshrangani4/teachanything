import { db as database } from "@teachanything/db";
import { crawlSources, crawledPages } from "@teachanything/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import { logInfo, logError } from "./logger";
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

  try {
    const inFlight = await db
      .select({
        id: crawlSources.id,
        status: crawlSources.status,
        updatedAt: crawlSources.updatedAt,
        lastPageActivityAt: sql<Date | null>`(
          SELECT MAX(${crawledPages.updatedAt})
          FROM ${crawledPages}
          WHERE ${crawledPages.crawlSourceId} = ${crawlSources.id}
        )`,
      })
      .from(crawlSources)
      .where(
        and(
          eq(crawlSources.userId, userId),
          inArray(crawlSources.status, [...IN_PROGRESS_STATUSES]),
        ),
      );

    if (inFlight.length === 0) return;

    const stalePreCrawl = inFlight.filter((source) =>
      isStalePreCrawl({
        status: source.status,
        updatedAt: source.updatedAt,
        now,
      }),
    );

    const staleCrawling = inFlight.filter((source) =>
      isStaleCrawl({
        status: source.status,
        lastPageActivityAt: source.lastPageActivityAt
          ? new Date(source.lastPageActivityAt)
          : null,
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
          inArray(
            crawlSources.id,
            stalePreCrawl.map((source) => source.id),
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
 * Close out a single stuck crawl: fail every page still in flight, then settle
 * the source. Lands on `completed` when some pages did make it through and
 * `failed` when none did, so the badge reflects what the user actually got.
 *
 * Shared by the stale sweep and the user-initiated cancel.
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
  const failedCount = (counts["failed"] ?? 0) + (counts["blocked"] ?? 0);

  await db
    .update(crawlSources)
    .set({
      status: completedCount > 0 ? "completed" : "failed",
      lastCrawledAt: completedCount > 0 ? now : undefined,
      metadata: mergeCrawlSourceMetadata({
        pageCount: completedCount,
        errorCount: failedCount,
        errors: [{ url: "crawl", error: sourceError }],
      }),
      updatedAt: now,
    })
    .where(eq(crawlSources.id, crawlSourceId));
}
