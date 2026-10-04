import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import type { db as database } from "@teachanything/db";
import { userFiles } from "@teachanything/db/schema";
import { logWarn } from "@/lib/logger";

/**
 * The database step of finalizeUpload, retried.
 *
 * By the time this runs the file is already in Storage, so failing here costs
 * the user a whole re-upload. The failures seen in practice are transient: a
 * pooler connection that stalls while the database is busy (Oct 1 2026, a
 * finalize that hung for two minutes, then never wrote its row). A fresh
 * attempt on a new connection is the cheap way through.
 *
 * Every attempt is safe to repeat because the row's id is the upload's fileId.
 * An attempt that timed out may still have committed, so each one first looks
 * for its own row before treating anything as a conflict.
 */

type Database = typeof database;
type UserFile = typeof userFiles.$inferSelect;

export interface NewFileRecord {
  id: string;
  userId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  storagePath: string;
}

export interface RetryOptions {
  /** Waits between attempts; one more attempt than there are delays. */
  retryDelaysMs: readonly number[];
  /** Stop waiting on one attempt after this long and start the next. */
  attemptTimeoutMs: number;
}

/** Normal finalize takes well under a second; 15 s means the connection is stuck. */
export const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  retryDelaysMs: [1_000, 3_000],
  attemptTimeoutMs: 15_000,
};

export async function createFileRecord(
  db: Database,
  file: NewFileRecord,
  options: RetryOptions = DEFAULT_RETRY_OPTIONS,
): Promise<UserFile> {
  const attempts = options.retryDelaysMs.length + 1;

  for (let attempt = 1; ; attempt++) {
    try {
      return await withTimeout(createOnce(db, file), options.attemptTimeoutMs);
    } catch (error) {
      // A duplicate name is the user's to fix, not something a retry changes.
      if (error instanceof TRPCError || attempt >= attempts) throw error;

      logWarn("Creating file record failed, retrying", {
        fileId: file.id,
        attempt,
        error: error instanceof Error ? error.message : String(error),
      });
      await sleep(options.retryDelaysMs[attempt - 1]!);
    }
  }
}

async function createOnce(
  db: Database,
  file: NewFileRecord,
): Promise<UserFile> {
  const committed = await findOwnRecord(db, file);
  if (committed) return committed;

  const [duplicate] = await db
    .select({ id: userFiles.id })
    .from(userFiles)
    .where(
      and(
        eq(userFiles.userId, file.userId),
        eq(userFiles.fileName, file.fileName),
      ),
    )
    .limit(1);

  if (duplicate) {
    throw new TRPCError({
      code: "CONFLICT",
      message: `A file with the name "${file.fileName}" already exists. Please rename your file or delete the existing one.`,
    });
  }

  const [created] = await db
    .insert(userFiles)
    .values({ ...file, processingStatus: "pending", metadata: {} })
    .onConflictDoNothing({ target: userFiles.id })
    .returning();
  if (created) return created;

  // An earlier attempt committed between the lookup above and this insert.
  const raced = await findOwnRecord(db, file);
  if (raced) return raced;

  throw new Error("Failed to create file record");
}

async function findOwnRecord(
  db: Database,
  file: NewFileRecord,
): Promise<UserFile | undefined> {
  const [own] = await db
    .select()
    .from(userFiles)
    .where(and(eq(userFiles.id, file.id), eq(userFiles.userId, file.userId)))
    .limit(1);
  return own;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timed out after ${ms} ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
