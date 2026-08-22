import { logInfo } from "@/lib/logger";
import { EMBEDDING_MODEL } from "@teachanything/ai/models";
import { createRAGService, createOpenRouterClient } from "@teachanything/ai";
import { updateProgress } from "./file-status";

type RagService = ReturnType<typeof createRAGService>;
type OpenRouterClient = ReturnType<typeof createOpenRouterClient>;

/**
 * Generate embeddings for every chunk in batches, validating each batch and
 * reporting progress after it completes. Returns the embeddings in chunk order.
 */
export async function embedChunksInBatches(params: {
  fileId: string;
  chunks: string[];
  ragService: RagService;
  openrouterClient: OpenRouterClient;
}): Promise<number[][]> {
  const { fileId, chunks, ragService, openrouterClient } = params;

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

  return embeddings;
}
