/**
 * Shared helpers for rendering RAG source citations across chat surfaces
 * (live chat and conversation audit views).
 */

export type SourceCitation = {
  fileName: string;
  chunkIndex: number;
  similarity: number;
  pageNumber?: number | null;
};

/**
 * Dedupe citations by fileName + pageNumber, keeping the highest-similarity
 * chunk per (file, page). O(n) via Map. The same file cited on different pages
 * yields separate badges; chunks without a page collapse under one key.
 */
export function dedupeSourcesByFileName<
  T extends {
    fileName: string;
    similarity: number;
    pageNumber?: number | null;
  },
>(sources: T[]): T[] {
  if (sources.length === 0) return sources;
  const best = new Map<string, T>();
  for (const s of sources) {
    const key = `${s.fileName}::${s.pageNumber ?? ""}`;
    const existing = best.get(key);
    if (!existing || s.similarity > existing.similarity) {
      best.set(key, s);
    }
  }
  return [...best.values()];
}

const WEB_PREFIX = "Web: ";

/**
 * rag-context.ts tags crawler-sourced chunks as `Web: <hostname>` so many
 * pages from the same site collapse to one badge. Splitting returns the
 * human label (without the prefix) and whether it came from the web.
 */
export function describeSource(source: { fileName: string }): {
  isWeb: boolean;
  label: string;
} {
  if (source.fileName.startsWith(WEB_PREFIX)) {
    return { isWeb: true, label: source.fileName.slice(WEB_PREFIX.length) };
  }
  return { isWeb: false, label: source.fileName };
}
