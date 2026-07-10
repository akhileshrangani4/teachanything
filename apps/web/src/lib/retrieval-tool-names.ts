/**
 * Canonical names of the agentic retrieval tools. Single source of truth so the
 * server-side privacy filter (stream-chat.ts) and the client status line
 * (ChatInterface.tsx) can never drift: a new retrieval tool added here updates
 * both. Zero imports so this stays safe to pull into the client bundle.
 *
 * These tools' RESULTS (raw document chunks) must never reach the browser; the
 * server strips their output chunks from the UI stream and their parts from
 * persisted metadata.
 */
export const RETRIEVAL_TOOL_NAMES = [
  "search_documents",
  "get_page",
  "get_context_around",
  "list_documents",
  "done",
] as const;

/** The same set, as the `tool-`-prefixed UIMessage part types the client sees. */
export const RETRIEVAL_PART_TYPES: ReadonlySet<string> = new Set(
  RETRIEVAL_TOOL_NAMES.map((name) => `tool-${name}`),
);

const RETRIEVAL_TOOL_NAME_SET: ReadonlySet<string> = new Set(
  RETRIEVAL_TOOL_NAMES,
);

/** True if a bare tool name is a retrieval tool. */
export function isRetrievalToolName(toolName: string): boolean {
  return RETRIEVAL_TOOL_NAME_SET.has(toolName);
}

/** True if a UIMessage part type (`tool-<name>`) belongs to a retrieval tool. */
export function isRetrievalToolPart(partType: string): boolean {
  const name = /^tool-(.+)$/.exec(partType)?.[1];
  return !!name && RETRIEVAL_TOOL_NAME_SET.has(name);
}
