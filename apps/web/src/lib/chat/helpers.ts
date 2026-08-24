import type { ChatStatus } from "ai";
import type { StudyUIMessage } from "@/server/chat/study-tools";
import { RETRIEVAL_PART_TYPES } from "@/lib/retrieval-tool-names";

/**
 * Pure helpers for the chat router and the chat UI. Kept free of the streaming
 * / AI-SDK runtime chain so they can be unit-tested in isolation -- the only
 * imports here are types and a zero-dependency constant set.
 *
 * Lives under lib/, not server/, because client components import it. Anything
 * under server/ must stay off client import paths so a server-only dependency
 * added later can't be pulled into the browser bundle.
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
 * Longest a user query is surfaced verbatim in a status label. Queries are
 * unbounded; past this we truncate with an ellipsis so the live status line
 * stays a single, stable-width line instead of wrapping and reflowing.
 */
const MAX_QUERY_LABEL_CHARS = 48;

function truncateForLabel(text: string): string {
  // Count by code point (Array.from), not UTF-16 code unit, so truncation never
  // slices through a surrogate pair (e.g. an emoji) and emits a broken glyph.
  const chars = Array.from(text);
  if (chars.length <= MAX_QUERY_LABEL_CHARS) return text;
  return `${chars.slice(0, MAX_QUERY_LABEL_CHARS).join("").trimEnd()}…`;
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
        ? `Searching documents for “${truncateForLabel(args.query)}”`
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

/**
 * Live status line shown while a turn is in flight, mapped to the real backend
 * phase so the user sees progress instead of a static loader. Driven by the AI
 * SDK stream `status` (never inferred from message shape):
 *  - `submitted`: request accepted; the server is retrieving sources + building
 *    context before the model starts.
 *  - `streaming` with an active retrieval tool: name the query/page it fetches.
 *  - `streaming` otherwise: the model is composing the answer.
 * The `ready`/`error` branch isn't normally rendered (the indicator hides once
 * streaming ends) but returns a safe generic label.
 */
export function deriveStatusLine(
  last: StudyUIMessage | undefined,
  status: ChatStatus,
): string {
  if (status === "submitted") return "Searching sources…";
  if (status !== "streaming") return "Thinking…";
  const parts = last?.role === "assistant" ? last.parts : [];
  const lastPart = parts[parts.length - 1];
  if (lastPart && RETRIEVAL_PART_TYPES.has(lastPart.type)) {
    // Retrieval tool *inputs* stream to the client (only results are filtered
    // server-side), so the label can name the query/page being fetched.
    return describeToolActivity(
      lastPart.type.slice("tool-".length),
      "input" in lastPart ? lastPart.input : undefined,
    );
  }
  return "Generating answer…";
}
