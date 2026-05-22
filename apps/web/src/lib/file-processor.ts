import { db } from "@teachanything/db";
import { userFiles, fileChunks } from "@teachanything/db/schema";
import { eq, ne, and } from "drizzle-orm";
import { createSupabaseClient } from "./supabase";
import { isLocalStorageMode, readLocalFile } from "./local-storage";
import { createOpenRouterClient, createRAGService } from "@teachanything/ai";
import { EMBEDDING_MODEL } from "@teachanything/ai/models";
import { env } from "./env";
import { logInfo, logError } from "./logger";

const EXTRACTION_TIMEOUT_MS = 30 * 60_000;

/**
 * Processing batch sizes - tuned for performance and rate limiting
 */
const PROCESSING_CONFIG = {
  /** Chunks per embedding batch (50 to avoid OpenRouter rate limits) */
  EMBEDDING_BATCH_SIZE: 50,
  /** Chunk records per database insert batch (500 for efficient bulk insert) */
  DB_INSERT_BATCH_SIZE: 500,
} as const;

type FileMetadata = NonNullable<typeof userFiles.$inferSelect.metadata>;

/**
 * Sanitize error messages before storing in metadata visible to users.
 * Prevents internal details (hostnames, connection strings, API keys) from leaking.
 */
function sanitizeProcessingError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  const errorName = error instanceof Error ? error.name : "";
  if (msg.includes("timed out")) return "File processing timed out";
  if (msg.includes("Unsupported file type")) return msg;
  if (msg.includes("no readable text")) return msg;
  if (msg.includes("Invalid image format")) return "Invalid image format";
  if (msg.includes("Image exceeds OCR size limit"))
    return "Image exceeds OCR size limit";
  if (msg.includes("Image dimensions exceed"))
    return "Image dimensions exceed maximum limit";
  if (msg.includes("too many pages for OCR")) return msg;
  if (msg.includes("too large to render for OCR")) return msg;
  if (msg.includes("Invalid PDF")) return "Invalid PDF format";
  if (msg.includes("embedding") && msg.includes("dimension"))
    return "Embedding dimension mismatch";
  if (
    msg.includes("Extraction aborted") ||
    msg.includes("timed out") ||
    errorName === "AbortError"
  )
    return "File processing timed out";
  return "File processing failed due to an internal error";
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
  currentPage?: number,
  totalPages?: number,
) {
  try {
    const now = new Date().toISOString();

    const [currentFile] = await db
      .select()
      .from(userFiles)
      .where(eq(userFiles.id, fileId))
      .limit(1);

    const existingMetadata: FileMetadata = currentFile?.metadata || {};
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
            currentPage,
            totalPages,
            startedAt,
            lastUpdatedAt: now,
          },
        },
      })
      .where(
        and(
          eq(userFiles.id, fileId),
          eq(userFiles.processingStatus, "processing"),
        ),
      );

    logInfo(`File processing progress: ${stage} ${percentage}%`, {
      fileId,
      stage,
      percentage,
      currentChunk,
      totalChunks,
      currentPage,
      totalPages,
    });
  } catch (err) {
    logError(err, "Failed to update processing progress (non-fatal)", {
      fileId,
      stage,
      percentage,
    });
  }
}

/**
 * Process a file: extract content, chunk, generate embeddings, and store
 * This function is used both by the QStash job handler (production) and inline processing (development)
 */
export async function processFile(params: {
  fileId: string;
}): Promise<{ success: boolean; chunkCount: number }> {
  const { fileId } = params;
  const ragService = createRAGService();

  try {
    const startTime = new Date().toISOString();
    logInfo("File processing started", { fileId });

    const [initialFile] = await db
      .select()
      .from(userFiles)
      .where(eq(userFiles.id, fileId))
      .limit(1);

    if (!initialFile) {
      // File was deleted while job was queued - exit gracefully
      logInfo("File not found (likely deleted), skipping processing", {
        fileId,
      });
      return {
        success: false,
        chunkCount: 0,
      };
    }

    const initialMetadata: FileMetadata = initialFile.metadata ?? {};
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { error: _initialError, ...cleanInitialMetadata } = initialMetadata;

    // Atomic status guard: only proceed if not already processing (per D-04, D-05)
    const guardResult = await db
      .update(userFiles)
      .set({
        processingStatus: "processing",
        metadata: {
          ...cleanInitialMetadata,
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
          return { success: false, chunkCount: 0 };
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
          return { success: false, chunkCount: 0 };
        }
        throw new Error(`Failed to download file: ${error?.message}`);
      }

      const arrayBuffer = await data.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    }

    await updateProgress(fileId, "downloading", 10);

    // Stage 2: Extract text content (10-30%)
    await updateProgress(fileId, "extracting", 10);
    let isExtractionActive = true;

    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      abortController.abort(
        new Error(
          `File extraction timed out after ${EXTRACTION_TIMEOUT_MS / 1000}s`,
        ),
      );
    }, EXTRACTION_TIMEOUT_MS);

    let content: string;
    try {
      content = await ragService.extractContent(
        buffer,
        file.fileType,
        async (progress) => {
          if (!isExtractionActive) return;
          if (progress.stage !== "ocr-page") return;

          const extractionPercentage = 10 + progress.percentage * 0.2;
          await updateProgress(
            fileId,
            "extracting",
            extractionPercentage,
            undefined,
            undefined,
            progress.currentPage,
            progress.totalPages,
          );
        },
        abortController.signal,
      );
    } finally {
      clearTimeout(timeoutId);
      isExtractionActive = false;
    }
    await updateProgress(fileId, "extracting", 30);

    // Stage 3: Chunk text (30-40%)
    await updateProgress(fileId, "chunking", 30);
    const chunks = await ragService.chunkText(content);
    await updateProgress(fileId, "chunking", 40, 0, chunks.length);

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

    for (
      let i = 0;
      i < chunks.length;
      i += PROCESSING_CONFIG.EMBEDDING_BATCH_SIZE
    ) {
      const batchEnd = Math.min(
        i + PROCESSING_CONFIG.EMBEDDING_BATCH_SIZE,
        chunks.length,
      );
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

      logInfo(
        `Batch ${Math.floor(i / PROCESSING_CONFIG.EMBEDDING_BATCH_SIZE) + 1} completed`,
        {
          fileId,
          processed: batchEnd,
          total: chunks.length,
          percentage: progress.toFixed(1),
        },
      );
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
        };
      }),
    );

    for (
      let i = 0;
      i < chunkRecords.length;
      i += PROCESSING_CONFIG.DB_INSERT_BATCH_SIZE
    ) {
      await db
        .insert(fileChunks)
        .values(
          chunkRecords.slice(i, i + PROCESSING_CONFIG.DB_INSERT_BATCH_SIZE),
        )
        .onConflictDoNothing();
    }
    await updateProgress(fileId, "storing", 95, chunks.length, chunks.length);

    // Update file status to completed
    await db
      .update(userFiles)
      .set({
        processingStatus: "completed",
        metadata: {
          chunkCount: chunks.length,
          processedAt: new Date().toISOString(),
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
      const [currentFile] = await db
        .select()
        .from(userFiles)
        .where(eq(userFiles.id, fileId))
        .limit(1);

      await db
        .update(userFiles)
        .set({
          processingStatus: "failed",
          metadata: {
            ...(currentFile?.metadata ?? {}),
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
  } finally {
    ragService.cleanup();
  }
}
