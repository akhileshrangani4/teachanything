import type { StudyUIMessage } from "@/server/chat/study-tools";
import { STUDY_TOOL_HANDLERS } from "./handlers";

/** A stored study-tool response row for a conversation. */
export type StoredStudyResponse = { toolName: string; response: unknown };

/**
 * Build a short note telling the model how the student did on the study tools
 * shown earlier in the conversation: each tool's label, and either its attempts
 * (summarized per the tool's handler, e.g. "attempt 1 scored 2/5") or that it
 * was shown but not answered. This is what makes the model aware of scores and
 * unfinished quizzes, since render-only tools return no result to the model.
 *
 * Tool-agnostic: only tools with a registered handler are summarized, using
 * that handler's `summarizeResponseForModel` / `labelForModel`. Returns "" when
 * no study tool was shown, so the caller can append unconditionally.
 */
export function buildStudyResultsNote(
  history: StudyUIMessage[],
  responsesByToolCallId: Map<string, StoredStudyResponse[]>,
): string {
  // Cap how many attempts one tool contributes to its line: the query behind
  // `responsesByToolCallId` is already bounded, but a retake-spamming student
  // shouldn't inflate the prompt -- the most recent attempts carry the signal.
  const MAX_ATTEMPTS_PER_TOOL = 10;

  const lines: string[] = [];
  for (const msg of history) {
    if (msg.role !== "assistant") continue;
    for (const part of msg.parts) {
      if (!part.type.startsWith("tool-")) continue;
      const toolName = part.type.slice("tool-".length);
      const handler = STUDY_TOOL_HANDLERS[toolName];
      if (!handler) continue; // not a response-capturing study tool
      // Only completed (rendered) parts: a part persisted mid-input-streaming
      // on an interrupted turn was never shown as an interactive widget, so
      // reporting it as "shown" would mislead the model.
      if ((part as { state?: unknown }).state !== "output-available") continue;
      const toolCallId = (part as { toolCallId?: unknown }).toolCallId;
      if (typeof toolCallId !== "string") continue;
      const input = (part as { input?: unknown }).input;
      const label = handler.labelForModel?.(input) ?? toolName;
      const responses = responsesByToolCallId.get(toolCallId) ?? [];
      if (responses.length === 0) {
        lines.push(
          `- ${label}: shown to the student, but they have not answered it yet.`,
        );
      } else {
        const shown = responses.slice(-MAX_ATTEMPTS_PER_TOOL);
        const offset = responses.length - shown.length;
        const attempts = shown
          .map(
            (r, i) =>
              `attempt ${offset + i + 1} ${handler.summarizeResponseForModel(r.response)}`,
          )
          .join("; ");
        const omitted =
          offset > 0 ? ` (${offset} earlier attempts omitted)` : "";
        lines.push(`- ${label}: ${attempts}${omitted}.`);
      }
    }
  }
  if (lines.length === 0) return "";
  return (
    "\n\nStudent study-tool activity so far (use it to tailor your reply -- " +
    "e.g. review missed questions or encourage a retake; do not repeat this list " +
    "verbatim):\n" +
    lines.join("\n")
  );
}
