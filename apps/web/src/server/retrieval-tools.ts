import { tool } from "ai";
import { z } from "zod";
import { eq, and, inArray, asc, sql } from "drizzle-orm";
import { fileChunks, userFiles } from "@teachanything/db/schema";
import type { db as DbType } from "@teachanything/db";
import type { OpenRouterClient } from "@teachanything/ai/openrouter";
import { hybridSearch, type HybridChunk } from "./hybrid-search";
import { sourceDisplayName } from "@/lib/message-sources";
import {
  searchDocumentsInput,
  getPageInput,
  getContextAroundInput,
} from "./retrieval-tool-schemas";

export {
  searchDocumentsInput,
  getPageInput,
  getContextAroundInput,
} from "./retrieval-tool-schemas";

export interface RetrievalToolContext {
  db: typeof DbType;
  fileIds: string[];
  aiClient: OpenRouterClient;
}

export interface RetrievalSource {
  fileName: string;
  chunkIndex: number;
  pageNumber: number | null;
  similarity: number | null;
}

export function createRetrievalTools(ctx: RetrievalToolContext) {
  const sources: RetrievalSource[] = [];
  const record = (chunks: HybridChunk[]) => {
    for (const c of chunks) {
      sources.push({
        // Same display normalization as the static path (Web: <hostname> for
        // crawled pages) so merged source lists dedupe on matching names.
        fileName: sourceDisplayName(c.fileName, c.storagePath),
        chunkIndex: c.chunkIndex,
        pageNumber: c.pageNumber,
        similarity: c.vectorSimilarity,
      });
    }
  };

  const tools = {
    search_documents: tool({
      description:
        "Search the attached documents for passages. Use the user's exact words or a quoted phrase for specific details. Returns passages with file name, page number, and chunk index. ALWAYS search before claiming something is or is not in the documents.",
      inputSchema: searchDocumentsInput,
      execute: async ({ query, fileId, limit }) => {
        // Authorization: reject a model-supplied fileId outside this chatbot's
        // scope, matching get_page / get_context_around (hybridSearch also
        // intersects defensively).
        if (fileId && !ctx.fileIds.includes(fileId)) {
          return { error: "Unknown document" };
        }
        const queryEmbedding = await ctx.aiClient.generateEmbedding(query);
        const results = await hybridSearch({
          db: ctx.db,
          fileIds: ctx.fileIds,
          query,
          queryEmbedding,
          limit: limit ?? 6,
          fileId,
        });
        record(results);
        return results.map((r) => ({
          fileName: r.fileName,
          pageNumber: r.pageNumber,
          chunkIndex: r.chunkIndex,
          content: r.content,
        }));
      },
    }),

    get_page: tool({
      description:
        "Return the full text of a specific page of a document. Use when the user asks about a page number or to verify a citation.",
      inputSchema: getPageInput,
      execute: async ({ fileId, pageNumber }) => {
        if (!ctx.fileIds.includes(fileId)) return { error: "Unknown document" };
        const rows = await ctx.db
          .select({
            content: fileChunks.content,
            chunkIndex: fileChunks.chunkIndex,
            fileName: userFiles.fileName,
          })
          .from(fileChunks)
          .innerJoin(userFiles, eq(fileChunks.fileId, userFiles.id))
          .where(
            and(
              eq(fileChunks.fileId, fileId),
              sql`(${fileChunks.metadata} ->> 'pageNumber')::int = ${pageNumber}`,
            ),
          )
          .orderBy(asc(fileChunks.chunkIndex));
        return {
          pageNumber,
          fileName: rows[0]?.fileName ?? null,
          text: rows.map((r) => r.content).join("\n"),
        };
      },
    }),

    get_context_around: tool({
      description:
        "Return a chunk and its immediate neighbors (previous and next) in document order. Use to recover context when a search hit reads as if it starts mid-thought.",
      inputSchema: getContextAroundInput,
      execute: async ({ fileId, chunkIndex }) => {
        if (!ctx.fileIds.includes(fileId)) return { error: "Unknown document" };
        const rows = await ctx.db
          .select({
            chunkId: fileChunks.id,
            content: fileChunks.content,
            chunkIndex: fileChunks.chunkIndex,
            metadata: fileChunks.metadata,
            fileName: userFiles.fileName,
            storagePath: userFiles.storagePath,
          })
          .from(fileChunks)
          .innerJoin(userFiles, eq(fileChunks.fileId, userFiles.id))
          .where(
            and(
              eq(fileChunks.fileId, fileId),
              inArray(fileChunks.chunkIndex, [
                chunkIndex - 1,
                chunkIndex,
                chunkIndex + 1,
              ]),
            ),
          )
          .orderBy(asc(fileChunks.chunkIndex));
        record(
          rows.map((r) => ({
            chunkId: r.chunkId,
            fileId,
            storagePath: r.storagePath,
            fileName: r.fileName,
            chunkIndex: r.chunkIndex,
            pageNumber:
              (r.metadata as { pageNumber?: number } | null)?.pageNumber ??
              null,
            content: r.content,
            vectorSimilarity: null,
          })),
        );
        return {
          fileName: rows[0]?.fileName ?? null,
          chunks: rows.map((r) => ({
            chunkIndex: r.chunkIndex,
            content: r.content,
          })),
        };
      },
    }),

    list_documents: tool({
      description:
        "List the documents attached to this chatbot with their page counts.",
      inputSchema: z.object({}),
      execute: async () => {
        if (ctx.fileIds.length === 0) return { documents: [] };
        const rows = await ctx.db
          .select({
            fileId: userFiles.id,
            fileName: userFiles.fileName,
            pageCount: sql<
              number | null
            >`max((${fileChunks.metadata} ->> 'pageNumber')::int)`,
          })
          .from(userFiles)
          .leftJoin(fileChunks, eq(fileChunks.fileId, userFiles.id))
          .where(inArray(userFiles.id, ctx.fileIds))
          .groupBy(userFiles.id, userFiles.fileName);
        return {
          documents: rows.map((r) => ({
            fileId: r.fileId,
            fileName: r.fileName,
            pageCount: r.pageCount ?? null,
          })),
        };
      },
    }),

    done: tool({
      description:
        "Call this with your final answer once you have gathered enough evidence. Cite the file and page for each claim.",
      inputSchema: z.object({
        answer: z.string(),
        sources: z.array(z.string()).optional(),
      }),
      // No execute: invoking `done` stops the loop (hasToolCall('done')).
    }),
  };

  return { tools, sources };
}
