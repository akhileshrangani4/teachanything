import { db } from "@teachanything/db";
import { userFiles } from "@teachanything/db/schema";
import { eq, ne, and } from "drizzle-orm";
import { createOpenRouterClient, createRAGService } from "@teachanything/ai";
import { env } from "@/lib/env";
import { logInfo, logError } from "@/lib/logger";
import {
  sanitizeProcessingError,
  STORAGE_MISSING_ERROR,
} from "@/lib/processing-error";
import { updateProgress, CURRENT_PROCESSING_VERSION } from "./file-status";
import { downloadFileBuffer } from "./storage-download";
import { embedChunksInBatches } from "./embedding";
import { extractMaterialContent } from "./material-content";
import { replaceFileIndex } from "./file-index-storage";

const MATERIAL_EXTRACTION_TIMEOUT_MS = 180_000;

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

/** Download, understand, embed, and atomically replace one file's index. */
export async function processFile(params: {
  fileId: string;
  targetProcessingVersion?: number;
  force?: boolean;
}): Promise<{ success: boolean; chunkCount: number }> {
  const { fileId } = params;
  const targetVersion =
    params.targetProcessingVersion ?? CURRENT_PROCESSING_VERSION;
  let previousFile: typeof userFiles.$inferSelect | undefined;

  try {
    const [file] = await db
      .select()
      .from(userFiles)
      .where(eq(userFiles.id, fileId))
      .limit(1);
    if (!file) {
      logInfo("File not found (likely deleted), skipping processing", {
        fileId,
      });
      return { success: false, chunkCount: 0 };
    }
    previousFile = file;

    const completedVersion = file.metadata?.processingVersion ?? 0;
    if (
      !params.force &&
      file.processingStatus === "completed" &&
      completedVersion >= targetVersion
    ) {
      logInfo("File already has the requested processing version, skipping", {
        fileId,
        completedVersion,
        targetVersion,
      });
      return {
        success: true,
        chunkCount: file.metadata?.chunkCount ?? 0,
      };
    }

    const startTime = new Date().toISOString();
    const preservedMetadata = Object.fromEntries(
      Object.entries(file.metadata ?? {}).filter(
        ([key]) =>
          ![
            "error",
            "refreshWarning",
            "refreshFailedAt",
            "reprocessQueuedAt",
          ].includes(key),
      ),
    ) as typeof file.metadata;
    const guardResult = await db
      .update(userFiles)
      .set({
        processingStatus: "processing",
        metadata: {
          ...preservedMetadata,
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
      logInfo("File already being processed by another job, skipping", {
        fileId,
      });
      return { success: false, chunkCount: 0 };
    }

    logInfo("File processing started", {
      fileId,
      targetVersion,
      visionModel: env.OPENAI_VISION_MODEL,
    });
    await updateProgress(fileId, "downloading", 5);
    const downloaded = await downloadFileBuffer({
      fileId,
      storagePath: file.storagePath,
    });
    if (!downloaded.ok) throw new Error(STORAGE_MISSING_ERROR);
    await updateProgress(fileId, "downloading", 10);

    await updateProgress(fileId, "extracting", 10);
    const ragService = createRAGService();
    const material = await withTimeout(
      extractMaterialContent({
        ragService,
        buffer: downloaded.buffer,
        mimeType: file.fileType,
        fileName: file.fileName,
        apiKey: env.OPENAI_API_KEY,
        visionModel: env.OPENAI_VISION_MODEL,
        onVisualAnalysis: () => updateProgress(fileId, "analyzing", 25),
      }),
      MATERIAL_EXTRACTION_TIMEOUT_MS,
      `File extraction timed out after ${MATERIAL_EXTRACTION_TIMEOUT_MS / 1000}s`,
    );
    if (material.chunks.length === 0) {
      throw new Error("File contains no readable content");
    }

    await updateProgress(fileId, "chunking", 40, 0, material.chunks.length);
    const chunks = material.chunks.map((chunk) => chunk.content);
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

    await updateProgress(fileId, "storing", 90, chunks.length, chunks.length);
    const chunkRecords = await Promise.all(
      material.chunks.map(async (chunk, index) => {
        const embedding = embeddings[index];
        if (!embedding) throw new Error(`Missing embedding for chunk ${index}`);
        return {
          fileId,
          chunkIndex: index,
          content: chunk.content,
          embedding,
          tokenCount: await ragService.countTokens(chunk.content),
          metadata: {
            ...(chunk.pageNumber == null
              ? {}
              : { pageNumber: chunk.pageNumber }),
            ...(chunk.section == null ? {} : { section: chunk.section }),
          },
        };
      }),
    );

    const completedAt = new Date().toISOString();
    await replaceFileIndex({
      fileId,
      chunks: chunkRecords,
      metadata: {
        chunkCount: chunks.length,
        processedAt: completedAt,
        processingVersion: targetVersion,
        visualCount: material.visualCount,
        ...(material.visionModel ? { visionModel: material.visionModel } : {}),
        processingProgress: {
          stage: "storing",
          percentage: 100,
          currentChunk: chunks.length,
          totalChunks: chunks.length,
          startedAt: startTime,
          lastUpdatedAt: completedAt,
        },
      },
    });

    logInfo("File processing completed", {
      fileId,
      chunkCount: chunks.length,
      visualCount: material.visualCount,
      visionModel: material.visionModel,
    });
    return { success: true, chunkCount: chunks.length };
  } catch (error) {
    logError(error, "File processing failed", { fileId });
    const ownerMessage = sanitizeProcessingError(error);
    const hadUsableIndex =
      previousFile?.processingStatus === "completed" ||
      (previousFile?.metadata?.chunkCount ?? 0) > 0;

    try {
      await db
        .update(userFiles)
        .set(
          hadUsableIndex
            ? {
                processingStatus: "completed",
                metadata: {
                  ...Object.fromEntries(
                    Object.entries(previousFile!.metadata ?? {}).filter(
                      ([key]) => key !== "reprocessQueuedAt",
                    ),
                  ),
                  refreshWarning: ownerMessage,
                  refreshFailedAt: new Date().toISOString(),
                },
              }
            : {
                processingStatus: "failed",
                metadata: { error: ownerMessage },
              },
        )
        .where(eq(userFiles.id, fileId));
    } catch (statusError) {
      logError(statusError, "Failed to settle file after processing error", {
        fileId,
      });
    }
    throw error;
  }
}
