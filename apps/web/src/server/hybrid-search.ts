import { eq, and, inArray, isNotNull, sql } from "drizzle-orm";
import { fileChunks, userFiles } from "@teachanything/db/schema";
import { reciprocalRankFusion } from "@teachanything/ai/rrf";
import type { db as DbType } from "@teachanything/db";

export interface HybridSearchParams {
  db: typeof DbType;
  fileIds: string[];
  query: string;
  queryEmbedding: number[];
  limit: number;
  /** Restrict to a single file (tool fileId arg). */
  fileId?: string;
}

export interface HybridChunk {
  chunkId: string;
  fileId: string;
  fileName: string;
  chunkIndex: number;
  pageNumber: number | null;
  content: string;
  vectorSimilarity: number | null;
}

/** Returns true when the query contains a "quoted phrase" — boosts FTS weight. */
export function hasQuotedPhrase(query: string): boolean {
  return /"[^"]+"/.test(query);
}

/**
 * Chatbot-scoped triple-fusion search over file chunks.
 *
 * Runs three independent retrievers — vector similarity (HNSW), Postgres
 * full-text (tsvector), and trigram (pg_trgm) — over the same file scope, then
 * fuses their rankings in TypeScript via Reciprocal Rank Fusion. FTS is weighted
 * higher when the user quoted an exact phrase.
 *
 * MATCHES rag-context.ts vector patterns: cosine `1 - (embedding <=> :json)` in
 * SELECT, raw distance `embedding <=> :json` in ORDER BY (HNSW index), the
 * `JSON.stringify(queryEmbedding)` literal, the userFiles join, and the
 * `processingStatus = 'completed'` + `isNotNull(embedding)` filters.
 */
export async function hybridSearch(
  params: HybridSearchParams,
): Promise<HybridChunk[]> {
  const { db, query, queryEmbedding, limit } = params;
  // Authorization: a single-file request must INTERSECT the chatbot-scoped set,
  // never replace it. params.fileId originates from a model tool call, so a
  // hallucinated/foreign UUID must not widen access beyond params.fileIds.
  const fileIds = params.fileId
    ? params.fileIds.filter((id) => id === params.fileId)
    : params.fileIds;
  if (fileIds.length === 0) return [];

  const overfetch = Math.min(limit * 2, 60);
  const embeddingLiteral = JSON.stringify(queryEmbedding);

  const baseWhere = and(
    inArray(fileChunks.fileId, fileIds),
    eq(userFiles.processingStatus, "completed"),
    isNotNull(fileChunks.embedding),
  );

  // 1. Vector candidates (HNSW, distance ascending)
  const vectorRows = await db
    .select({
      chunkId: fileChunks.id,
      similarity: sql<number>`1 - (${fileChunks.embedding} <=> ${embeddingLiteral})`,
    })
    .from(fileChunks)
    .innerJoin(userFiles, eq(fileChunks.fileId, userFiles.id))
    .where(baseWhere)
    .orderBy(sql`${fileChunks.embedding} <=> ${embeddingLiteral}`)
    .limit(overfetch);

  // 2. Full-text candidates (websearch_to_tsquery + ts_rank_cd)
  const ftsRows = await db
    .select({ chunkId: fileChunks.id })
    .from(fileChunks)
    .innerJoin(userFiles, eq(fileChunks.fileId, userFiles.id))
    .where(
      and(
        baseWhere,
        sql`to_tsvector('english', ${fileChunks.content}) @@ websearch_to_tsquery('english', ${query})`,
      ),
    )
    .orderBy(
      sql`ts_rank_cd(to_tsvector('english', ${fileChunks.content}), websearch_to_tsquery('english', ${query})) DESC`,
    )
    .limit(overfetch);

  // 3. Trigram candidates (similarity DESC). Uses pg_trgm % operator.
  const trgmRows = await db
    .select({ chunkId: fileChunks.id })
    .from(fileChunks)
    .innerJoin(userFiles, eq(fileChunks.fileId, userFiles.id))
    .where(and(baseWhere, sql`${fileChunks.content} % ${query}`))
    .orderBy(sql`similarity(${fileChunks.content}, ${query}) DESC`)
    .limit(overfetch);

  // Fuse via RRF. FTS weighted higher when the user quoted an exact phrase.
  const ftsWeight = hasQuotedPhrase(query) ? 2 : 1;
  const fusedIds = reciprocalRankFusion<string>(
    [
      { items: vectorRows.map((r) => r.chunkId), weight: 1 },
      { items: ftsRows.map((r) => r.chunkId), weight: ftsWeight },
      { items: trgmRows.map((r) => r.chunkId), weight: 1 },
    ],
    { k: 60 },
  ).slice(0, limit);

  if (fusedIds.length === 0) return [];

  const simById = new Map(vectorRows.map((r) => [r.chunkId, r.similarity]));
  const rows = await db
    .select({
      chunkId: fileChunks.id,
      fileId: fileChunks.fileId,
      fileName: userFiles.fileName,
      chunkIndex: fileChunks.chunkIndex,
      metadata: fileChunks.metadata,
      content: fileChunks.content,
    })
    .from(fileChunks)
    .innerJoin(userFiles, eq(fileChunks.fileId, userFiles.id))
    .where(inArray(fileChunks.id, fusedIds));

  const byId = new Map(rows.map((r) => [r.chunkId, r]));
  return fusedIds
    .map((id) => byId.get(id))
    .filter((r): r is NonNullable<typeof r> => r != null)
    .map((r) => ({
      chunkId: r.chunkId,
      fileId: r.fileId,
      fileName: r.fileName,
      chunkIndex: r.chunkIndex,
      pageNumber:
        (r.metadata as { pageNumber?: number } | null)?.pageNumber ?? null,
      content: r.content,
      vectorSimilarity: simById.get(r.chunkId) ?? null,
    }));
}
