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
      return `Reading page ${String(args.pageNumber)}…`;
    case "get_context_around":
      return "Reading surrounding context…";
    case "list_documents":
      return "Looking through your documents…";
    default:
      return "Working…";
  }
}
