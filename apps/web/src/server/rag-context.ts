import { eq, and, isNotNull } from "drizzle-orm";
import {
  chatbotFileAssociations,
  chatbotCrawlSourceAssociations,
  userFiles,
  crawledPages,
  crawlSources,
} from "@teachanything/db/schema";
import { hybridSearch } from "./hybrid-search";
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
    // Present when the chunk carries page metadata (page-aware PDF ingestion).
    pageNumber?: number | null;
  }>;
  ragUsed: boolean;
  fileManifest: string;
  ragFailureNote: string;
  // File IDs the chat router needs to build retrieval tools for the agentic
  // path. Empty when the chatbot has no completed (enabled) files.
  fileIds: string[];
}

/**
 * Build RAG context for a chatbot message.
 *
 * Queries completed files, builds a file manifest with anti-hallucination
 * instructions, generates a query embedding, runs the same hybrid search
 * (vector + full-text + trigram, RRF-fused) the agentic tools use, and formats
 * chunk context with source attribution.
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

  const fileNames = completedFiles.map((f) => f.fileName);
  let fileIds = completedFiles.map((f) => f.fileId);

  // Filter out files belonging to disabled crawl sources. Drive the query
  // from crawl_sources (which has idx_crawl_sources_chatbot_id) scoped to
  // this chatbot -- usually returns 0 rows, letting us skip the filter.
  // Avoids a seq-scan on the unindexed crawled_pages.user_file_id column
  // on every chat message.
  if (fileIds.length > 0) {
    const disabledCrawledFiles = await params.db
      .select({ userFileId: crawledPages.userFileId })
      .from(chatbotCrawlSourceAssociations)
      .innerJoin(
        crawlSources,
        eq(crawlSources.id, chatbotCrawlSourceAssociations.crawlSourceId),
      )
      .innerJoin(crawledPages, eq(crawledPages.crawlSourceId, crawlSources.id))
      .where(
        and(
          eq(chatbotCrawlSourceAssociations.chatbotId, params.chatbotId),
          eq(crawlSources.enabled, false),
          isNotNull(crawledPages.userFileId),
        ),
      );
    if (disabledCrawledFiles.length > 0) {
      const disabled = new Set(
        disabledCrawledFiles
          .map((r) => r.userFileId)
          .filter((id): id is string => id !== null),
      );
      fileIds = fileIds.filter((id) => !disabled.has(id));
    }
  }

  // 2. Build file manifest (D-01, D-03: anti-hallucination instruction).
  // Cap the listed names so chatbots with many files don't bloat the system
  // prompt (it is re-sent on every agentic step). The model can always discover
  // the full set via the list_documents tool / search.
  const MANIFEST_FILE_LIMIT = 20;
  const fileManifest =
    fileNames.length > 0
      ? `\n\nYou have access to ${fileNames.length} document${fileNames.length === 1 ? "" : "s"}, including: [${fileNames
          .slice(0, MANIFEST_FILE_LIMIT)
          .join(", ")}${
          fileNames.length > MANIFEST_FILE_LIMIT
            ? `, and ${fileNames.length - MANIFEST_FILE_LIMIT} more`
            : ""
        }]. When asked about files, refer only to documents that actually exist. Do not invent or guess file names.`
      : "";

  // 3. Short-circuit if no completed files (skip embedding API call entirely)
  if (fileIds.length === 0) {
    return {
      contextText: "",
      sources: [],
      ragUsed: false,
      fileManifest,
      ragFailureNote: "",
      fileIds: [],
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
      fileIds,
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
      fileIds,
    };
  }

  // 5. Hybrid retrieval (vector + FTS + trigram, RRF-fused). Same retriever
  // the agentic search_documents tool uses, so both chat paths share one
  // embedding and one search implementation.
  const effectiveChunkLimit =
    params.chunkLimit ?? Math.min(fileIds.length * 2, 30);

  const relevantChunks = await hybridSearch({
    db: params.db,
    fileIds,
    query: params.message,
    queryEmbedding,
    limit: effectiveChunkLimit,
  });

  // 6. Format chunks with source attribution (D-04)
  const sources: RAGContextResult["sources"] = [];

  if (relevantChunks.length === 0) {
    return {
      contextText: "",
      sources: [],
      ragUsed: false,
      fileManifest,
      ragFailureNote: "",
      fileIds,
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
        if (chunk.storagePath && /^https?:\/\//i.test(chunk.storagePath)) {
          try {
            displayName = `Web: ${new URL(chunk.storagePath).hostname}`;
          } catch {
            // malformed URL, fall back to raw filename
          }
        }
        sources.push({
          fileName: displayName,
          chunkIndex: chunk.chunkIndex,
          // D-05: real similarity in metadata only. Chunks surfaced by the
          // lexical retrievers (FTS/trigram) but outside the vector top-k have
          // no vector similarity -- record 0 rather than a fake score.
          similarity: chunk.vectorSimilarity ?? 0,
          pageNumber: chunk.pageNumber,
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
  return {
    contextText,
    sources,
    ragUsed,
    fileManifest,
    ragFailureNote: "",
    fileIds,
  };
}
