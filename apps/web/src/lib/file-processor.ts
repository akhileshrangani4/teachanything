import { db } from "@teachanything/db";
import { userFiles, fileChunks } from "@teachanything/db/schema";
import { eq, ne, and } from "drizzle-orm";
import { createSupabaseClient } from "./supabase";
import { isLocalStorageMode, readLocalFile } from "./local-storage";
import { createOpenRouterClient, createRAGService } from "@teachanything/ai";
import { EMBEDDING_MODEL } from "@teachanything/ai/models";
import { env } from "./env";
import { logInfo, logError } from "./logger";
import {
  sanitizeProcessingError,
  STORAGE_MISSING_ERROR,
} from "./processing-error";

const EXTRACTION_TIMEOUT_MS = 60_000;

/**
 * Bump when ingestion logic changes (chunking, page metadata, etc.). Files with
 * userFiles.metadata.processingVersion < this are reprocessed lazily on access.
 * v1 = pre-page flat chunks @2500; v2 = page-aware @1000 with pageNumber.
 */
export const CURRENT_PROCESSING_VERSION = 2;

/**
 * Sanitize error messages before storing in metadata visible to users.
 * Prevents internal details (hostnames, connection strings, API keys) from leaking.
 */
/**
 * Mark a file failed and stop. Used by the paths that bail out mid-run without
 * throwing: the atomic guard has already flipped the row to `processing`, so
 * returning without a terminal status leaves it claimed forever -- a spinner the
 * owner cannot clear and that every QStash retry bounces off. The stale sweep
 * would eventually catch it, but only after 15 minutes and with a misleading
 * "stopped responding" message, so settle it here with the real reason.
 */
async function abandonProcessing(
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

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message: string,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() =>
    clearTimeout(timeoutId),
  );
}

/**
 * Helper to update file processing progress
 */
async function updateProgress(
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

/**
 * Process a file: extract content, chunk, generate embeddings, and store
 * This function is used both by the QStash job handler (production) and inline processing (development)
 */
export async function processFile(params: {
  fileId: string;
}): Promise<{ success: boolean; chunkCount: number }> {
  const { fileId } = params;

  try {
    const startTime = new Date().toISOString();
    logInfo("File processing started", { fileId });

    // Atomic status guard: only proceed if not already processing (per D-04, D-05)
    const guardResult = await db
      .update(userFiles)
      .set({
        processingStatus: "processing",
        metadata: {
          processingProgress: {
            stage: "downloading",
            percentage: 0,
            startedAt: startTime,
            lastUpdatedAt: startTime,
          },
        },
      })
      .where(
        and(
          eq(userFiles.id, fileId),
          ne(userFiles.processingStatus, "processing"),
        ),
      )
      .returning({ id: userFiles.id });

    if (guardResult.length === 0) {
      // Another job is already processing this file -- exit early
      logInfo("File already being processed by another job, skipping", {
        fileId,
      });
      return { success: false, chunkCount: 0 };
    }

    // Safety net: delete any existing chunks before reprocessing
    // This catches QStash retries and any other processing path
    await db.delete(fileChunks).where(eq(fileChunks.fileId, fileId));

    logInfo("Cleared existing chunks before processing", { fileId });

    // Get file from database
    const [file] = await db
      .select()
      .from(userFiles)
      .where(eq(userFiles.id, fileId))
      .limit(1);

    if (!file) {
      // File was deleted while job was queued - exit gracefully
      logInfo("File not found (likely deleted), skipping processing", {
        fileId,
      });
      return {
        success: false,
        chunkCount: 0,
      };
    }

    // Stage 1: Download file from storage (0-10%)
    await updateProgress(fileId, "downloading", 5);

    let buffer: Buffer;

    if (isLocalStorageMode()) {
      try {
        buffer = await readLocalFile(file.storagePath);
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") {
          logInfo(
            "File not found in local storage (likely deleted), skipping processing",
            { fileId, storagePath: file.storagePath },
          );
          return abandonProcessing(fileId, STORAGE_MISSING_ERROR);
        }
        throw err;
      }
    } else {
      const supabase = createSupabaseClient();
      const { data, error } = await supabase.storage
        .from("chatbot-files")
        .download(file.storagePath);

      if (error || !data) {
        if (
          error?.message?.includes("not found") ||
          error?.message?.includes("does not exist")
        ) {
          logInfo(
            "File storage not found (likely deleted), skipping processing",
            { fileId, storagePath: file.storagePath },
          );
          return abandonProcessing(fileId, STORAGE_MISSING_ERROR);
        }
        throw new Error(`Failed to download file: ${error?.message}`);
      }

      const arrayBuffer = await data.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    }

    await updateProgress(fileId, "downloading", 10);

    // Stage 2: Extract text content (10-30%)
    await updateProgress(fileId, "extracting", 10);
    const ragService = createRAGService();
    const pagedChunks = await withTimeout(
      ragService.extractAndChunk(buffer, file.fileType),
      EXTRACTION_TIMEOUT_MS,
      `File extraction timed out after ${EXTRACTION_TIMEOUT_MS / 1000}s`,
    );
    await updateProgress(fileId, "extracting", 30);

    // Stage 3: Chunk text (30-40%)
    await updateProgress(fileId, "chunking", 30);
    const chunks = pagedChunks.map((c) => c.content);
    await updateProgress(fileId, "chunking", 40, 0, pagedChunks.length);

    // Stage 4: Generate embeddings (40-90%)
    // This is the slowest part, so batch process and report progress
    await updateProgress(fileId, "embedding", 40, 0, chunks.length);
    const openrouterClient = createOpenRouterClient(
      env.OPENROUTER_API_KEY,
      env.OPENAI_API_KEY,
    );

    // Generate embeddings in batches for better performance
    const embeddings: number[][] = [];
    const embeddingProgressStart = 40;
    const embeddingProgressRange = 50; // 40% to 90%
    const BATCH_SIZE = 50; // Process 50 chunks at a time (reduced to avoid rate limits)

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batchEnd = Math.min(i + BATCH_SIZE, chunks.length);
      const batch = chunks.slice(i, batchEnd);

      // Validate batch
      for (let j = 0; j < batch.length; j++) {
        if (!batch[j]) {
          throw new Error(`Missing chunk at index ${i + j}`);
        }
      }

      // Generate embeddings for entire batch in parallel
      const batchEmbeddings = await ragService.generateEmbeddingsForChunks(
        batch,
        openrouterClient,
      );

      // Validate embeddings
      for (let j = 0; j < batchEmbeddings.length; j++) {
        const embedding = batchEmbeddings[j];
        if (!embedding) {
          throw new Error(`Failed to generate embedding for chunk ${i + j}`);
        }
        if (embedding.length !== EMBEDDING_MODEL.dimensions) {
          throw new Error(
            `Embedding dimension mismatch for chunk ${i + j}: got ${embedding.length}, expected ${EMBEDDING_MODEL.dimensions}`,
          );
        }
      }

      embeddings.push(...batchEmbeddings);

      // Update progress after each batch
      const progress =
        embeddingProgressStart +
        (batchEnd / chunks.length) * embeddingProgressRange;
      await updateProgress(
        fileId,
        "embedding",
        progress,
        batchEnd,
        chunks.length,
      );

      logInfo(`Batch ${Math.floor(i / BATCH_SIZE) + 1} completed`, {
        fileId,
        processed: batchEnd,
        total: chunks.length,
        percentage: progress.toFixed(1),
      });
    }

    // Stage 5: Store chunks with embeddings in database (90-100%)
    await updateProgress(fileId, "storing", 90, chunks.length, chunks.length);
    const chunkRecords = await Promise.all(
      chunks.map(async (chunk, index) => {
        const embedding = embeddings[index];
        if (!embedding) {
          throw new Error(`Missing embedding for chunk ${index}`);
        }
        return {
          fileId,
          chunkIndex: index,
          content: chunk,
          embedding,
          tokenCount: await ragService.countTokens(chunk),
          metadata:
            pagedChunks[index]?.pageNumber != null
              ? { pageNumber: pagedChunks[index]!.pageNumber }
              : {},
        };
      }),
    );

    await db.insert(fileChunks).values(chunkRecords).onConflictDoNothing();
    await updateProgress(fileId, "storing", 95, chunks.length, chunks.length);

    // Update file status to completed
    await db
      .update(userFiles)
      .set({
        processingStatus: "completed",
        metadata: {
          chunkCount: chunks.length,
          processedAt: new Date().toISOString(),
          processingVersion: CURRENT_PROCESSING_VERSION,
          processingProgress: {
            stage: "storing",
            percentage: 100,
            currentChunk: chunks.length,
            totalChunks: chunks.length,
            startedAt: startTime,
            lastUpdatedAt: new Date().toISOString(),
          },
        },
      })
      .where(eq(userFiles.id, fileId));

    logInfo("File processing completed", {
      fileId,
      chunkCount: chunks.length,
    });

    return {
      success: true,
      chunkCount: chunks.length,
    };
  } catch (error) {
    logError(error, "File processing failed", { fileId });

    // Clean up any orphaned chunks from partial processing (per D-02)
    // Wrapped in its own try/catch so cleanup failure doesn't mask the original error (per D-03)
    try {
      await db.delete(fileChunks).where(eq(fileChunks.fileId, fileId));
    } catch (cleanupError) {
      logError(
        cleanupError,
        "Failed to clean up chunks after processing error",
        {
          fileId,
        },
      );
    }

    // Mark file as failed -- wrapped in try/catch so status update failure
    // doesn't mask the original processing error
    try {
      await db
        .update(userFiles)
        .set({
          processingStatus: "failed",
          metadata: {
            error: sanitizeProcessingError(error),
          },
        })
        .where(eq(userFiles.id, fileId));
    } catch (statusError) {
      logError(
        statusError,
        "Failed to mark file as failed after processing error",
        {
          fileId,
        },
      );
    }

    throw error;
  }
}
