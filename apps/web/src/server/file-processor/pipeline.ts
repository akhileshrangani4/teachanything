import { db } from "@teachanything/db";
import { userFiles, fileChunks } from "@teachanything/db/schema";
import { eq, ne, and } from "drizzle-orm";
import { createOpenRouterClient, createRAGService } from "@teachanything/ai";
import { env } from "@/lib/env";
import { logInfo, logError } from "@/lib/logger";
import {
  sanitizeProcessingError,
  STORAGE_MISSING_ERROR,
} from "@/lib/processing-error";
import {
  abandonProcessing,
  updateProgress,
  CURRENT_PROCESSING_VERSION,
} from "./file-status";
import { downloadFileBuffer } from "./storage-download";
import { embedChunksInBatches } from "./embedding";

const EXTRACTION_TIMEOUT_MS = 60_000;

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

    const downloaded = await downloadFileBuffer({
      fileId,
      storagePath: file.storagePath,
    });
    if (!downloaded.ok) {
      return abandonProcessing(fileId, STORAGE_MISSING_ERROR);
    }
    const buffer = downloaded.buffer;

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

    const embeddings = await embedChunksInBatches({
      fileId,
      chunks,
      ragService,
      openrouterClient,
    });

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
