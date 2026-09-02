import type { db as database } from "@teachanything/db";
import { userFiles } from "@teachanything/db/schema";
import { and, asc, eq, inArray } from "drizzle-orm";
import { excludeCrawledPages, isCrawledPagePath } from "./crawled-page-files";
import { logInfo, logError } from "@/lib/logger";

/**
 * A file sitting in `pending` this long never had its job picked up -- the
 * QStash publish failed silently, or every delivery attempt was rejected.
 *
 * Measured from the last recorded activity, not from `createdAt`: `files.retry`
 * re-queues an existing file by setting it back to `pending`, and an upload
 * from last week is not stale just because it is being retried today.
 */
export const STALE_PENDING_MS = 15 * 60 * 1000;

/**
 * A file in `processing` is judged by progress activity, not by when it
 * started: a large document legitimately takes minutes. `maxDuration` on
 * /api/jobs/process-file caps one attempt at 5 minutes, and each embedding
 * batch writes `lastUpdatedAt`, so 15 minutes of total silence means every
 * attempt (including QStash retries) is gone.
 */
export const STALE_PROCESSING_MS = 15 * 60 * 1000;

/** Statuses that show the user a spinner and can therefore hang forever. */
const IN_PROGRESS_STATUSES = ["pending", "processing"] as const;

/** Bounds one sweep so a pathological account can't stall the list read. */
const MAX_SWEPT_FILES = 200;

/**
 * How long one sweep covers a user for.
 *
 * The sweep fronts two list procedures, and the Files tab polls them while an
 * upload processes -- so without this every poll paid for an extra query to
 * re-derive an answer that cannot have changed. Nothing here is time-critical:
 * the thresholds are 15 minutes, so re-checking more often than once a minute
 * buys nothing.
 */
const SWEEP_INTERVAL_MS = 60_000;

/**
 * Last successful sweep per user, for `SWEEP_INTERVAL_MS`.
 *
 * Per-instance and best-effort on purpose. A cold instance just sweeps once
 * more than it strictly had to, which is the cheap direction to be wrong in --
 * the alternative (a shared lock) would cost more than the query it saves.
 */
const lastSweptAt = new Map<string, number>();

/** Keeps the throttle map from growing without bound on a long-lived instance. */
export const MAX_THROTTLE_ENTRIES = 10_000;

function shouldSweep(userId: string, now: Date): boolean {
  const previous = lastSweptAt.get(userId);
  return (
    previous === undefined || now.getTime() - previous >= SWEEP_INTERVAL_MS
  );
}

function recordSweep(userId: string, now: Date): void {
  // Bounded by clearing rather than by evicting: an entry is worth exactly one
  // skipped query, so dropping all of them costs at most one extra sweep per
  // active user. Not expected to fire -- one entry per active user per instance
  // -- but it keeps a long-lived instance from growing without bound.
  if (lastSweptAt.size >= MAX_THROTTLE_ENTRIES) lastSweptAt.clear();
  lastSweptAt.set(userId, now.getTime());
}

export const STALE_PENDING_ERROR =
  "Processing never started. It may have been interrupted -- use Retry to try again.";

export const STALE_PROCESSING_ERROR =
  "Processing stopped responding and was timed out. Use Retry to try again; if it keeps failing, the file may be too large or contain no readable text.";

type StaleFileMetadata = {
  processingProgress?: { startedAt?: string; lastUpdatedAt?: string };
} | null;

/**
 * The most recent sign of life for a file, as a timestamp.
 *
 * `lastUpdatedAt` is rewritten at every pipeline stage and after every
 * embedding batch, so it is the real activity signal. It is absent until the
 * first progress write lands, hence the fallbacks. An unparseable value is
 * treated as no signal at all rather than throwing.
 */
export function lastFileActivityAt(params: {
  metadata: StaleFileMetadata;
  createdAt: Date;
}): Date {
  const progress = params.metadata?.processingProgress;
  for (const stamp of [progress?.lastUpdatedAt, progress?.startedAt]) {
    if (!stamp) continue;
    const parsed = new Date(stamp);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return params.createdAt;
}

/**
 * True when an in-progress file has gone quiet long enough that its worker is
 * presumed dead.
 *
 * This is the only way out of a wedged file. `processFile` claims the file with
 * an atomic `status -> processing` guard and refuses to re-enter a file already
 * in `processing`, so a worker that dies without reaching its `catch` -- killed
 * at the duration limit, an OOM, a deploy mid-run -- leaves the row claimed
 * forever. Every QStash retry then bails at the guard, and nothing else ever
 * revisits it.
 */
export function isStaleFile(params: {
  status: string;
  storagePath: string | null;
  metadata: StaleFileMetadata;
  createdAt: Date;
  now: Date;
}): boolean {
  const { status, now } = params;
  if (status !== "pending" && status !== "processing") return false;
  // Crawled pages share this table and are recovered by `sweepStaleCrawls`, not
  // here. They also never carry a `processingProgress` stamp -- a re-crawl sets
  // `processing` without touching metadata -- so dating one from `createdAt`
  // condemns a live re-crawl of a page first crawled weeks ago. The candidate
  // query already filters them out; this keeps the guarantee in the predicate
  // so a future caller can't lose it.
  if (isCrawledPagePath(params.storagePath)) return false;
  const limit = status === "pending" ? STALE_PENDING_MS : STALE_PROCESSING_MS;
  const lastActivity = lastFileActivityAt({
    metadata: params.metadata,
    createdAt: params.createdAt,
  });
  return now.getTime() - lastActivity.getTime() > limit;
}

/** The message shown for a swept file, by the status it was swept from. */
export function staleFileError(status: string): string {
  return status === "pending" ? STALE_PENDING_ERROR : STALE_PROCESSING_ERROR;
}

/**
 * Mark abandoned file-processing runs as failed so they stop spinning forever
 * and the owner can retry or delete them.
 *
 * Modelled on `sweepStaleCrawls`: recovery has to be driven from stored state,
 * because the worker that should have written a terminal status is exactly the
 * thing that died. Runs opportunistically on the file list reads, so it
 * self-heals the moment the owner next opens the page.
 *
 * Covers uploaded files only. Crawled pages live in `userFiles` too but are
 * owned by `sweepStaleCrawls`, which judges them by crawl-page activity rather
 * than by this table's progress stamps -- see `excludeCrawledPages`.
 *
 * Throttled per user (see `SWEEP_INTERVAL_MS`), so a polling list read does not
 * re-run it on every request. Never throws; a failed sweep must not break the
 * read that triggered it, and a failure is not recorded, so the next read
 * retries instead of waiting out the interval.
 */
export async function sweepStaleFiles(params: {
  db: typeof database;
  userId: string;
  now?: Date;
}): Promise<void> {
  const { db, userId } = params;
  const now = params.now ?? new Date();

  if (!shouldSweep(userId, now)) return;

  try {
    const candidates = await db
      .select({
        id: userFiles.id,
        processingStatus: userFiles.processingStatus,
        storagePath: userFiles.storagePath,
        metadata: userFiles.metadata,
        createdAt: userFiles.createdAt,
      })
      .from(userFiles)
      .where(
        and(
          eq(userFiles.userId, userId),
          inArray(userFiles.processingStatus, [...IN_PROGRESS_STATUSES]),
          excludeCrawledPages,
        ),
      )
      // Oldest first, so the `MAX_SWEPT_FILES` cap takes the rows most likely
      // to be stale instead of an arbitrary slice. Without an order, an account
      // over the cap can hand back the same page of rows forever and never
      // reach the rest.
      .orderBy(asc(userFiles.createdAt))
      .limit(MAX_SWEPT_FILES);

    const stale = candidates.filter((file) =>
      isStaleFile({
        status: file.processingStatus,
        storagePath: file.storagePath,
        metadata: file.metadata,
        createdAt: file.createdAt,
        now,
      }),
    );
    if (stale.length === 0) {
      recordSweep(userId, now);
      return;
    }

    // Grouped by the message each status earns, and re-checked against the
    // status in the WHERE clause so a file that started making progress between
    // the read and the write is left alone.
    for (const status of IN_PROGRESS_STATUSES) {
      const ids = stale
        .filter((file) => file.processingStatus === status)
        .map((file) => file.id);
      if (ids.length === 0) continue;

      await db
        .update(userFiles)
        .set({
          processingStatus: "failed",
          metadata: { error: staleFileError(status) },
        })
        .where(
          and(
            inArray(userFiles.id, ids),
            eq(userFiles.processingStatus, status),
            excludeCrawledPages,
          ),
        );
    }

    recordSweep(userId, now);
    logInfo("Timed out stale file processing", {
      userId,
      count: stale.length,
    });
  } catch (error) {
    logError(error, "Failed to sweep stale files", { userId });
  }
}
