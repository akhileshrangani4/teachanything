import { createSupabaseClient } from "@/server/supabase";
import { deleteLocalFile, isLocalStorageMode } from "@/server/local-storage";

/** Most object keys sent to Storage in one delete request. */
export const STORAGE_REMOVE_BATCH_SIZE = 1000;

/** Most `exists` checks in flight at once when confirming a short remove. */
const EXISTS_CHECK_CONCURRENCY = 10;

type StorageBucket = ReturnType<
  ReturnType<typeof createSupabaseClient>["storage"]["from"]
>;

/** Split `items` into consecutive groups of at most `size`. */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (!Number.isInteger(size) || size < 1) {
    throw new RangeError(`chunk size must be a positive integer, got ${size}`);
  }
  const groups: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    groups.push(items.slice(i, i + size));
  }
  return groups;
}

/**
 * Remove uploaded files from whichever storage backend is active, throwing if
 * any of them may still be there.
 *
 * An object that is already gone counts as removed, so a retry after a
 * partial failure succeeds. Callers that delete database rows pointing at
 * these files must call this first and stop if it throws: a row deleted ahead
 * of its object leaves that object with nothing pointing at it.
 */
export async function removeStoredFiles(
  storagePaths: readonly string[],
): Promise<void> {
  if (storagePaths.length === 0) return;

  if (isLocalStorageMode()) {
    // deleteLocalFile already treats a missing file as deleted.
    for (const storagePath of storagePaths) {
      await deleteLocalFile(storagePath);
    }
    return;
  }

  const bucket = createSupabaseClient().storage.from("chatbot-files");
  for (const batch of chunk(storagePaths, STORAGE_REMOVE_BATCH_SIZE)) {
    const { data: removed, error } = await bucket.remove(batch);
    if (error) throw error;

    // Storage reports success with nothing removed both for keys that are
    // already gone and for keys it lacked the rights to delete (see
    // files.delete). Only the first is safe, so confirm every key Storage
    // did not list as removed.
    const removedNames = new Set(removed.map((object) => object.name));
    await assertNoneExist(
      bucket,
      batch.filter((storagePath) => !removedNames.has(storagePath)),
    );
  }
}

async function assertNoneExist(
  bucket: StorageBucket,
  storagePaths: readonly string[],
): Promise<void> {
  for (const group of chunk(storagePaths, EXISTS_CHECK_CONCURRENCY)) {
    // `exists` resolves false for a missing object and throws on any other
    // failure, so its `error` field carries nothing to act on here.
    const results = await Promise.all(
      group.map((storagePath) => bucket.exists(storagePath)),
    );
    const remaining = group.filter((_, i) => results[i]?.data);
    if (remaining.length > 0) {
      throw new Error(
        `Storage did not delete ${remaining.length} of ${storagePaths.length} unconfirmed files`,
      );
    }
  }
}
