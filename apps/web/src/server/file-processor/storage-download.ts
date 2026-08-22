import { createSupabaseClient } from "../supabase";
import { isLocalStorageMode, readLocalFile } from "../local-storage";
import { logInfo } from "@/lib/logger";

/**
 * Download a file's bytes from storage (Supabase, or the local filesystem in
 * local-storage mode).
 *
 * Returns `{ ok: false }` when the object is gone (deleted while the job sat
 * in the queue); the caller settles the row via `abandonProcessing`. Any other
 * failure throws.
 */
export async function downloadFileBuffer(params: {
  fileId: string;
  storagePath: string;
}): Promise<{ ok: true; buffer: Buffer } | { ok: false }> {
  const { fileId, storagePath } = params;

  if (isLocalStorageMode()) {
    try {
      return { ok: true, buffer: await readLocalFile(storagePath) };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        logInfo(
          "File not found in local storage (likely deleted), skipping processing",
          { fileId, storagePath },
        );
        return { ok: false };
      }
      throw err;
    }
  }

  const supabase = createSupabaseClient();
  const { data, error } = await supabase.storage
    .from("chatbot-files")
    .download(storagePath);

  if (error || !data) {
    if (
      error?.message?.includes("not found") ||
      error?.message?.includes("does not exist")
    ) {
      logInfo("File storage not found (likely deleted), skipping processing", {
        fileId,
        storagePath,
      });
      return { ok: false };
    }
    throw new Error(`Failed to download file: ${error?.message}`);
  }

  const arrayBuffer = await data.arrayBuffer();
  return { ok: true, buffer: Buffer.from(arrayBuffer) };
}
