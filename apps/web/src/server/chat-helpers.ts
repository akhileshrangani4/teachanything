/**
 * Pure, dependency-free helpers for the chat router. Kept in their own module
 * so they can be unit-tested without importing the streaming / AI-SDK chain
 * that `chat.ts` pulls in.
 */

/** Clamp a requested max output token count to the supported range (100-4000). */
export function clampMaxTokens(maxTokens: number | null | undefined): number {
  const MIN_TOKENS = 100;
  const MAX_TOKENS = 4000;
  const DEFAULT_TOKENS = 2000;

  if (maxTokens == null || isNaN(maxTokens)) {
    return DEFAULT_TOKENS;
  }

  return Math.max(MIN_TOKENS, Math.min(MAX_TOKENS, maxTokens));
}

export interface ChatSource {
  fileName: string;
  chunkIndex: number;
  similarity: number;
  pageNumber?: number | null;
}

export interface ToolSource {
  fileName: string;
  chunkIndex: number;
  pageNumber: number | null;
  similarity: number | null;
}

/**
 * Merge the statically-injected RAG sources with sources accumulated from
 * agentic tool calls, deduping by file + chunk. Injected sources keep their
 * position; tool-discovered chunks are appended in call order. Tool similarity
 * is coerced null -> 0 so existing consumers (which expect a number and
 * dedupe/score on it) keep working.
 */
export function mergeSources(
  ragSources: ChatSource[],
  toolSources: ToolSource[],
): ChatSource[] {
  const seen = new Set(
    ragSources.map((s) => `${s.fileName}\u0000${s.chunkIndex}`),
  );
  const merged = [...ragSources];
  for (const s of toolSources) {
    const key = `${s.fileName}\u0000${s.chunkIndex}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push({
      fileName: s.fileName,
      chunkIndex: s.chunkIndex,
      similarity: s.similarity ?? 0,
      pageNumber: s.pageNumber,
    });
  }
  return merged;
}

/**
 * Map an agentic retrieval tool-call to a human-readable status label shown in
 * the live status line while the model works. Only the action + the
 * user-derived query are surfaced -- never tool RESULT content (which could
 * contain document text on public shared bots).
 */
export function describeToolActivity(toolName: string, input: unknown): string {
  const args = (input ?? {}) as {
    query?: unknown;
    pageNumber?: unknown;
  };
  switch (toolName) {
    case "search_documents":
      return typeof args.query === "string" && args.query.length > 0
        ? `Searching documents for “${args.query}”`
        : "Searching documents…";
    case "get_page":
      // The client calls this while the tool input is still streaming, so
      // pageNumber may not have arrived yet.
      return typeof args.pageNumber === "number"
        ? `Reading page ${args.pageNumber}…`
        : "Reading a page…";
    case "get_context_around":
      return "Reading surrounding context…";
    case "list_documents":
      return "Looking through your documents…";
    default:
      return "Working…";
  }
}
