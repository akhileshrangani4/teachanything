import { db } from "@teachanything/db";
import { userFiles, fileChunks } from "@teachanything/db/schema";
import { eq } from "drizzle-orm";
import { createSupabaseClient } from "./supabase";
import { isLocalStorageMode, readLocalFile } from "./local-storage";
import { createOpenRouterClient, createRAGService } from "@teachanything/ai";
import { env } from "./env";
import { logInfo, logError } from "./logger";

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
  const startedAt = existingMetadata?.processingProgress?.startedAt || now;

  await db
    .update(userFiles)
    .set({
      processingStatus: "processing",
      metadata: {
        ...existingMetadata,
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

    // Initialize processing with starting timestamp
    await db
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
      .where(eq(userFiles.id, fileId));

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
          error.message?.includes("not found") ||
          error.message?.includes("does not exist")
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
    const ragService = createRAGService();
    const content = await ragService.extractContent(buffer, file.fileType);
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
        if (!batchEmbeddings[j]) {
          throw new Error(`Failed to generate embedding for chunk ${i + j}`);
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
        };
      }),
    );

    await db.insert(fileChunks).values(chunkRecords);
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

    // Update file status to failed
    await db
      .update(userFiles)
      .set({
        processingStatus: "failed",
        metadata: {
          error: error instanceof Error ? error.message : String(error),
        },
      })
      .where(eq(userFiles.id, fileId));

    throw error;
  }
}
