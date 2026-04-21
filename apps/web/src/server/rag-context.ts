import { eq, and, or, sql, inArray, isNotNull, isNull } from "drizzle-orm";
import {
  fileChunks,
  chatbotFileAssociations,
  userFiles,
  crawledPages,
  crawlSources,
} from "@teachanything/db/schema";
import {
  createOpenRouterClient,
  EMBEDDING_MODEL,
  type OpenRouterClient,
} from "@teachanything/ai";
import { logError, logInfo, logWarn } from "@/lib/logger";
import type { db as dbType } from "@teachanything/db";

export interface BuildRAGContextParams {
  chatbotId: string;
  message: string;
  db: typeof dbType;
  openrouterApiKey: string;
  openaiApiKey: string;
  /** Budget-derived chunk limit. Falls back to min(fileCount * 2, 30) when omitted. */
  chunkLimit?: number;
  /** Reuse an existing client instead of creating a new one per call. */
  aiClient?: OpenRouterClient;
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
  // 1. Query completed files first (needed for manifest and to decide if embedding is needed)
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

  // 3. Short-circuit if no completed files (skip embedding API call entirely)
  if (fileIds.length === 0) {
    return {
      contextText: "",
      sources: [],
      ragUsed: false,
      fileManifest,
      ragFailureNote: "",
    };
  }

  // 4. Generate embedding (only when files exist to search)
  const aiClient =
    params.aiClient ??
    createOpenRouterClient(params.openrouterApiKey, params.openaiApiKey);

  const queryEmbedding = await aiClient
    .generateEmbedding(params.message)
    .catch((error) => {
      logError(
        error,
        "Failed to generate embeddings - continuing without RAG",
        { chatbotId: params.chatbotId },
      );
      return null;
    });
  let ragFailureNote = "";

  if (!queryEmbedding) {
    ragFailureNote =
      "[SYSTEM NOTICE: Document search is temporarily unavailable due to a technical issue. " +
      "You MUST inform the user that you cannot search their uploaded documents right now. " +
      "Respond using only your general knowledge. Do not reference, quote, or guess about " +
      "content from uploaded files.]\n\n";
    logWarn("RAG context degraded - continuing without document search", {
      chatbotId: params.chatbotId,
    });
    return {
      contextText: "",
      sources: [],
      ragUsed: false,
      fileManifest,
      ragFailureNote,
    };
  }

  // 4b. Validate embedding dimensions and values (defense-in-depth)
  if (
    queryEmbedding.length !== EMBEDDING_MODEL.dimensions ||
    queryEmbedding.some((v) => !Number.isFinite(v))
  ) {
    logWarn("Invalid query embedding received", {
      chatbotId: params.chatbotId,
      dimensions: queryEmbedding.length,
      expectedDimensions: EMBEDDING_MODEL.dimensions,
    });
    return {
      contextText: "",
      sources: [],
      ragUsed: false,
      fileManifest,
      ragFailureNote: "",
    };
  }

  // 5. Vector similarity search with all fixes
  const effectiveChunkLimit =
    params.chunkLimit ?? Math.min(fileIds.length * 2, 30);

  // D-06, RAG-03: Real cosine similarity in SELECT
  const similarityExpr = sql<number>`1 - (${fileChunks.embedding} <=> ${JSON.stringify(queryEmbedding)})`;

  // LEFT JOIN crawled_pages + crawl_sources so we can filter out chunks
  // belonging to a disabled crawl source. Uploaded files don't match the
  // LEFT JOIN, so their crawl_sources.enabled is NULL and they pass the
  // filter via the OR clause.
  const relevantChunks = await params.db
    .select({
      content: fileChunks.content,
      chunkIndex: fileChunks.chunkIndex,
      fileName: userFiles.fileName,
      storagePath: userFiles.storagePath,
      similarity: similarityExpr,
    })
    .from(fileChunks)
    .innerJoin(userFiles, eq(fileChunks.fileId, userFiles.id))
    .leftJoin(crawledPages, eq(crawledPages.userFileId, userFiles.id))
    .leftJoin(crawlSources, eq(crawlSources.id, crawledPages.crawlSourceId))
    .where(
      and(
        inArray(fileChunks.fileId, fileIds),
        eq(userFiles.processingStatus, "completed"), // D-08: defense-in-depth
        isNotNull(fileChunks.embedding), // D-09, RAG-06
        or(isNull(crawlSources.id), eq(crawlSources.enabled, true)),
      ),
    )
    // CRITICAL: ORDER BY raw distance ascending to use HNSW index
    .orderBy(sql`${fileChunks.embedding} <=> ${JSON.stringify(queryEmbedding)}`)
    .limit(effectiveChunkLimit);

  // 6. Format chunks with source attribution (D-04)
  const sources: RAGContextResult["sources"] = [];

  if (relevantChunks.length === 0) {
    return {
      contextText: "",
      sources: [],
      ragUsed: false,
      fileManifest,
      ragFailureNote: "",
    };
  }

  const contextText =
    "\n\nRelevant context from uploaded documents:\n\n" +
    relevantChunks
      .map((chunk) => {
        const rawName = chunk.fileName || "Unknown";
        // Crawler-sourced files have storagePath as a URL. Collapse the
        // display name to "Web: <hostname>" so many pages from one site
        // dedupe into a single source badge in the UI.
        let displayName = rawName;
        if (
          chunk.storagePath &&
          /^https?:\/\//i.test(chunk.storagePath)
        ) {
          try {
            displayName = `Web: ${new URL(chunk.storagePath).hostname}`;
          } catch {
            // malformed URL, fall back to raw filename
          }
        }
        sources.push({
          fileName: displayName,
          chunkIndex: chunk.chunkIndex,
          similarity: chunk.similarity, // D-05: real similarity in metadata only
        });
        // D-04: give the LLM the actual page title/URL for accurate citations
        return `[Source: ${rawName}, Part ${chunk.chunkIndex + 1}]\n${chunk.content}`;
      })
      .join("\n\n");

  // 7. Compute ragUsed
  const ragUsed = queryEmbedding !== null && sources.length > 0;

  logInfo("RAG context built", {
    chatbotId: params.chatbotId,
    fileCount: fileIds.length,
    chunkCount: relevantChunks.length,
    chunkLimit: effectiveChunkLimit,
    ragUsed,
  });

  // 8. Return result
  return { contextText, sources, ragUsed, fileManifest, ragFailureNote: "" };
}
