/**
 * Shared helpers for rendering RAG source citations across chat surfaces
 * (live chat and conversation audit views).
 */

export type SourceCitation = {
  fileName: string;
  chunkIndex: number;
  similarity: number;
};

/**
 * Dedupe citations by fileName, keeping the highest-similarity chunk per
 * file. O(n) via Map. Mirrors the historical behavior of ChatMessage.tsx.
 */
export function dedupeSourcesByFileName<
  T extends { fileName: string; similarity: number },
>(sources: T[]): T[] {
  if (sources.length === 0) return sources;
  const best = new Map<string, T>();
  for (const s of sources) {
    const existing = best.get(s.fileName);
    if (!existing || s.similarity > existing.similarity) {
      best.set(s.fileName, s);
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
