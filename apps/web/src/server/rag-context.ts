import { eq, and, sql, inArray, isNotNull } from "drizzle-orm";
import {
  fileChunks,
  chatbotFileAssociations,
  userFiles,
} from "@teachanything/db/schema";
import { createOpenRouterClient } from "@teachanything/ai";
import { logError, logInfo, logWarn } from "@/lib/logger";
import type { db as dbType } from "@teachanything/db";

export interface BuildRAGContextParams {
  chatbotId: string;
  message: string;
  db: typeof dbType;
  openrouterApiKey: string;
  openaiApiKey: string;
}

export interface RAGContextResult {
  contextText: string;
  sources: Array<{
    fileName: string;
    chunkIndex: number;
    similarity: number;
  }>;
  ragUsed: boolean;
  fileManifest: string;
  ragFailureNote: string;
}

/**
 * Build RAG context for a chatbot message.
 *
 * Queries completed files, builds a file manifest with anti-hallucination
 * instructions, generates a query embedding, performs vector similarity search,
 * and formats chunk context with source attribution.
 *
 * Returns fileManifest even when embedding fails (file awareness without RAG).
 */
export async function buildRAGContext(
  params: BuildRAGContextParams,
): Promise<RAGContextResult> {
  // 1. Query completed files BEFORE embedding (Pitfall 3: manifest doesn't depend on embeddings)
  const completedFiles = await params.db
    .select({
      fileId: chatbotFileAssociations.fileId,
      fileName: userFiles.fileName,
    })
    .from(chatbotFileAssociations)
    .innerJoin(userFiles, eq(chatbotFileAssociations.fileId, userFiles.id))
    .where(
      and(
        eq(chatbotFileAssociations.chatbotId, params.chatbotId),
        eq(userFiles.processingStatus, "completed"),
      ),
    );

  const fileIds = completedFiles.map((f) => f.fileId);
  const fileNames = completedFiles.map((f) => f.fileName);

  // 2. Build file manifest (D-01, D-03: anti-hallucination instruction)
  const fileManifest =
    fileNames.length > 0
      ? `\n\nYou have access to these documents: [${fileNames.join(", ")}]. When asked about files, refer only to this list. Do not invent or guess file names.`
      : "";

  // 3. Short-circuit if no completed files
  if (fileIds.length === 0) {
    return { contextText: "", sources: [], ragUsed: false, fileManifest, ragFailureNote: "" };
  }

  // 4. Generate query embedding (continue without RAG on failure)
  const aiClient = createOpenRouterClient(
    params.openrouterApiKey,
    params.openaiApiKey,
  );

  let queryEmbedding: number[] | null = null;
  let ragFailureNote = "";
  try {
    queryEmbedding = await aiClient.generateEmbedding(params.message);
  } catch (error) {
    logError(error, "Failed to generate embeddings - continuing without RAG", {
      chatbotId: params.chatbotId,
    });
    ragFailureNote =
      "[SYSTEM NOTICE: Document search is temporarily unavailable due to a technical issue. " +
      "You MUST inform the user that you cannot search their uploaded documents right now. " +
      "Respond using only your general knowledge. Do not reference, quote, or guess about " +
      "content from uploaded files.]\n\n";
    logWarn("RAG context degraded - continuing without document search", {
      chatbotId: params.chatbotId,
    });
  }

  if (!queryEmbedding) {
    return { contextText: "", sources: [], ragUsed: false, fileManifest, ragFailureNote };
  }

  // 5. Vector similarity search with all fixes
  const chunkLimit = Math.min(fileIds.length * 2, 30); // D-07, RAG-04

  // D-06, RAG-03: Real cosine similarity in SELECT
  const similarityExpr = sql<number>`1 - (${fileChunks.embedding} <=> ${JSON.stringify(queryEmbedding)})`;

  const relevantChunks = await params.db
    .select({
      content: fileChunks.content,
      chunkIndex: fileChunks.chunkIndex,
      fileName: userFiles.fileName,
      similarity: similarityExpr,
    })
    .from(fileChunks)
    .innerJoin(userFiles, eq(fileChunks.fileId, userFiles.id))
    .where(
      and(
        inArray(fileChunks.fileId, fileIds),
        eq(userFiles.processingStatus, "completed"), // D-08: defense-in-depth
        isNotNull(fileChunks.embedding), // D-09, RAG-06
      ),
    )
    // CRITICAL: ORDER BY raw distance ascending to use HNSW index
    .orderBy(
      sql`${fileChunks.embedding} <=> ${JSON.stringify(queryEmbedding)}`,
    )
    .limit(chunkLimit);

  // 6. Format chunks with source attribution (D-04)
  const sources: RAGContextResult["sources"] = [];

  if (relevantChunks.length === 0) {
    return { contextText: "", sources: [], ragUsed: false, fileManifest, ragFailureNote: "" };
  }

  const contextText =
    "\n\nRelevant context from uploaded documents:\n\n" +
    relevantChunks
      .map((chunk) => {
        const fileName = chunk.fileName || "Unknown";
        sources.push({
          fileName,
          chunkIndex: chunk.chunkIndex,
          similarity: chunk.similarity, // D-05: real similarity in metadata only
        });
        // D-04: [Source: filename.pdf, Part 3]\n<content>
        return `[Source: ${fileName}, Part ${chunk.chunkIndex + 1}]\n${chunk.content}`;
      })
      .join("\n\n");

  // 7. Compute ragUsed
  const ragUsed = queryEmbedding !== null && sources.length > 0;

  logInfo("RAG context built", {
    chatbotId: params.chatbotId,
    fileCount: fileIds.length,
    chunkCount: relevantChunks.length,
    chunkLimit,
    ragUsed,
  });

  // 8. Return result
  return { contextText, sources, ragUsed, fileManifest, ragFailureNote: "" };
}
