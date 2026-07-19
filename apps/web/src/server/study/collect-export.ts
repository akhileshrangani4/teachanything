/**
 * Pairs persisted study-tool widgets (`tool-*` parts in an assistant message's
 * `metadata.parts`) with the student's attempts (`study_tool_responses` rows),
 * matched on `toolCallId`, for the chat-records export. Kept tool-agnostic: the
 * caller hands raw rows/parts in and gets generic `{ toolName, input, responses }`
 * out, so new study tools need no change here. Pure + exported for testing.
 */

export interface CollectedStudyToolResponse {
  attempt: number;
  response: unknown;
}

export interface CollectedStudyTool {
  toolName: string;
  input: unknown;
  responses: CollectedStudyToolResponse[];
}

export interface StudyResponseRow {
  conversationId: string;
  toolCallId: string;
  attempt: number;
  response: unknown;
}

function responseKey(conversationId: string, toolCallId: string): string {
  return `${conversationId}::${toolCallId}`;
}

/** Group attempt rows by (conversation, toolCallId); `response` left raw. */
export function groupStudyResponses(
  rows: StudyResponseRow[],
): Map<string, CollectedStudyToolResponse[]> {
  const byKey = new Map<string, CollectedStudyToolResponse[]>();
  for (const row of rows) {
    const key = responseKey(row.conversationId, row.toolCallId);
    const list = byKey.get(key) ?? [];
    list.push({ attempt: row.attempt, response: row.response });
    byKey.set(key, list);
  }
  return byKey;
}

/**
 * Extract renderable study-tool widgets from a persisted message's `parts`,
 * attaching matched attempts. `parts` is `unknown[]` in the db layer, so
 * everything is validated defensively. A `tool-*` part is included unless it is
 * still streaming or errored (states that never rendered a usable widget).
 */
export function collectStudyTools(
  parts: unknown,
  conversationId: string,
  responsesByKey: Map<string, CollectedStudyToolResponse[]>,
): CollectedStudyTool[] {
  if (!Array.isArray(parts)) return [];
  const tools: CollectedStudyTool[] = [];
  for (const part of parts) {
    if (!part || typeof part !== "object") continue;
    const p = part as {
      type?: unknown;
      toolCallId?: unknown;
      state?: unknown;
      input?: unknown;
    };
    if (typeof p.type !== "string" || !p.type.startsWith("tool-")) continue;
    // Skip parts that never became a usable widget for the student. Anything
    // else (including a persisted part with no `state`) is treated as shown.
    if (p.state === "input-streaming" || p.state === "output-error") continue;
    const toolName = p.type.slice("tool-".length);
    const toolCallId =
      typeof p.toolCallId === "string" ? p.toolCallId : undefined;
    const responses = toolCallId
      ? (responsesByKey.get(responseKey(conversationId, toolCallId)) ?? [])
      : [];
    tools.push({ toolName, input: p.input ?? null, responses });
  }
  return tools;
}
