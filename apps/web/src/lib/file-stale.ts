import type { db as database } from "@teachanything/db";
import { userFiles } from "@teachanything/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { logInfo, logError } from "./logger";

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
  metadata: StaleFileMetadata;
  createdAt: Date;
  now: Date;
}): boolean {
  const { status, now } = params;
  if (status !== "pending" && status !== "processing") return false;
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
 * Never throws; a failed sweep must not break the read that triggered it.
 */
export async function sweepStaleFiles(params: {
  db: typeof database;
  userId: string;
  now?: Date;
}): Promise<void> {
  const { db, userId } = params;
  const now = params.now ?? new Date();

  try {
    const candidates = await db
      .select({
        id: userFiles.id,
        processingStatus: userFiles.processingStatus,
        metadata: userFiles.metadata,
        createdAt: userFiles.createdAt,
      })
      .from(userFiles)
      .where(
        and(
          eq(userFiles.userId, userId),
          inArray(userFiles.processingStatus, [...IN_PROGRESS_STATUSES]),
        ),
      )
      .limit(MAX_SWEPT_FILES);

    const stale = candidates.filter((file) =>
      isStaleFile({
        status: file.processingStatus,
        metadata: file.metadata,
        createdAt: file.createdAt,
        now,
      }),
    );
    if (stale.length === 0) return;

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
          ),
        );
    }

    logInfo("Timed out stale file processing", {
      userId,
      count: stale.length,
    });
  } catch (error) {
    logError(error, "Failed to sweep stale files", { userId });
  }
}
