import { db } from "@teachanything/db";
import { userFiles } from "@teachanything/db/schema";
import { eq } from "drizzle-orm";
import { logInfo, logError } from "@/lib/logger";

/**
 * Bump when ingestion logic changes (chunking, page metadata, etc.). Files with
 * userFiles.metadata.processingVersion < this are reprocessed lazily on access.
 * v1 = pre-page flat chunks @2500; v2 = page-aware @1000 with pageNumber.
 */
export const CURRENT_PROCESSING_VERSION = 2;

/**
 * Mark a file failed and stop. Used by the paths that bail out mid-run without
 * throwing: the atomic guard has already flipped the row to `processing`, so
 * returning without a terminal status leaves it claimed forever -- a spinner the
 * owner cannot clear and that every QStash retry bounces off. The stale sweep
 * would eventually catch it, but only after 15 minutes and with a misleading
 * "stopped responding" message, so settle it here with the real reason.
 */
export async function abandonProcessing(
  fileId: string,
  reason: string,
): Promise<{ success: false; chunkCount: 0 }> {
  try {
    await db
      .update(userFiles)
      .set({ processingStatus: "failed", metadata: { error: reason } })
      .where(eq(userFiles.id, fileId));
  } catch (statusError) {
    logError(statusError, "Failed to mark abandoned file as failed", {
      fileId,
    });
  }
  return { success: false, chunkCount: 0 };
}

/**
 * Helper to update file processing progress
 */
export async function updateProgress(
  fileId: string,
  stage: "downloading" | "extracting" | "chunking" | "embedding" | "storing",
  percentage: number,
  currentChunk?: number,
  totalChunks?: number,
) {
  const now = new Date().toISOString();

  // Get current file to preserve existing metadata
  const [currentFile] = await db
    .select()
    .from(userFiles)
    .where(eq(userFiles.id, fileId))
    .limit(1);

  const existingMetadata = currentFile?.metadata || {};
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { error: _prevError, ...cleanMetadata } = existingMetadata;
  const startedAt = existingMetadata?.processingProgress?.startedAt || now;

  await db
    .update(userFiles)
    .set({
      processingStatus: "processing",
      metadata: {
        ...cleanMetadata,
        processingProgress: {
          stage,
          percentage: Math.min(100, Math.max(0, percentage)),
          currentChunk,
          totalChunks,
          startedAt,
          lastUpdatedAt: now,
        },
      },
    })
    .where(eq(userFiles.id, fileId));

  logInfo(`File processing progress: ${stage} ${percentage}%`, {
    fileId,
    stage,
    percentage,
    currentChunk,
    totalChunks,
  });
}
