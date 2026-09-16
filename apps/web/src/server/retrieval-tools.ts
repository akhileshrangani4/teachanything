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

  /** Documents attached to this chatbot, id and name. Queried at most once. */
  let documentIndex: Array<{ fileId: string; fileName: string }> | null = null;
  const listDocuments = async () => {
    if (!documentIndex) {
      documentIndex =
        ctx.fileIds.length === 0
          ? []
          : await ctx.db
              .select({
                fileId: userFiles.id,
                fileName: userFiles.fileName,
              })
              .from(userFiles)
              .where(inArray(userFiles.id, ctx.fileIds));
    }
    return documentIndex;
  };

  /**
   * Turn whatever the model passed as `fileId` into a real document id.
   *
   * The system prompt's file manifest lists NAMES, so a model that never
   * called `list_documents` has only a name to offer. Accepting one costs a
   * single cached query and saves a turn; the alternative is an error the
   * student sees as "Failed to generate a response".
   *
   * An unresolvable reference comes back as a tool result listing what does
   * exist, so the model can correct itself on the next step rather than the
   * turn ending. Still authorization-safe: nothing outside `ctx.fileIds`
   * is ever matched.
   */
  const resolveFileId = async (
    reference: string,
  ): Promise<
    | { ok: true; fileId: string }
    | { ok: false; result: { error: string; availableDocuments: string[] } }
  > => {
    if (ctx.fileIds.includes(reference)) {
      return { ok: true, fileId: reference };
    }

    const documents = await listDocuments();
    const wanted = reference.trim().toLowerCase();
    const byName = documents.find(
      (d) =>
        d.fileName.toLowerCase() === wanted ||
        sourceDisplayName(d.fileName, null).toLowerCase() === wanted,
    );

    if (byName) return { ok: true, fileId: byName.fileId };

    return {
      ok: false,
      result: {
        error: `No document matches "${reference}". Use one of the names below, or call list_documents for their ids.`,
        availableDocuments: documents.map((d) => d.fileName),
      },
    };
  };

  const tools = {
    search_documents: tool({
      description:
        "Search the attached documents for passages. Use the user's exact words or a quoted phrase for specific details. Returns passages with file name, page number, and chunk index. ALWAYS search before claiming something is or is not in the documents.",
      inputSchema: searchDocumentsInput,
      execute: async ({ query, fileId, limit }) => {
        // Authorization: a model-supplied reference is resolved only against
        // this chatbot's files, so nothing outside scope can be reached
        // (hybridSearch also intersects defensively).
        let resolvedFileId: string | undefined;
        if (fileId) {
          const resolved = await resolveFileId(fileId);
          if (!resolved.ok) return resolved.result;
          resolvedFileId = resolved.fileId;
        }
        const queryEmbedding = await ctx.aiClient.generateEmbedding(query);
        const results = await hybridSearch({
          db: ctx.db,
          fileIds: ctx.fileIds,
          query,
          queryEmbedding,
          limit: limit ?? 6,
          fileId: resolvedFileId,
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
        const resolved = await resolveFileId(fileId);
        if (!resolved.ok) return resolved.result;
        if (pageNumber < 1) {
          return {
            error: `Pages are numbered from 1, so page ${pageNumber} does not exist.`,
          };
        }
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
              eq(fileChunks.fileId, resolved.fileId),
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
        const resolved = await resolveFileId(fileId);
        if (!resolved.ok) return resolved.result;
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
              eq(fileChunks.fileId, resolved.fileId),
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
            fileId: resolved.fileId,
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
