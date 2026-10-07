import type { FinishReason, ToolSet } from "ai";
import { isRetrievalToolName } from "@/lib/retrieval-tool-names";
import { studyTools } from "./study-tools";

/** Steps the agentic loop may take; the last one must answer (see below). */
export const MAX_AGENT_STEPS = 5;

/**
 * Appended to the system prompt for the loop's final step, which runs without
 * the retrieval tools.
 *
 * Without this a model that kept searching used the final step on one more
 * search, and the turn ended with nothing but the sentence it wrote before
 * searching ("Let me search more specifically for..."). Taking the tools away
 * is not enough on its own: a model in the middle of a search habit just writes
 * that sentence again, so it is also told why the tools are gone.
 *
 * It extends the system prompt rather than riding as a trailing message: not
 * every open-model chat template accepts a system message mid-conversation, and
 * a user message would read as the student asking. The cost is a prompt-cache
 * miss on this step for what follows the system prompt.
 */
const FINAL_STEP_NOTE =
  "\n\nThis is your last step for this reply and the document search tools are no longer available. " +
  "Answer the student now from the passages you have already retrieved. " +
  "If they do not answer the question, say plainly that you could not find it in the course materials. " +
  "Do not say that you will search, or offer to search again.";

/**
 * Per-step settings for the agentic loop: the final step drops the retrieval
 * tools (study tools stay, so a quiz request can still be answered) and adds
 * FINAL_STEP_NOTE. A no-op for turns without retrieval tools.
 */
export function finalStepSettings(
  tools: ToolSet,
  systemPrompt: string,
  stepNumber: number,
): { activeTools: string[]; system: string } | undefined {
  const names = Object.keys(tools);
  if (stepNumber !== MAX_AGENT_STEPS - 1) return undefined;
  if (!names.some(isRetrievalToolName)) return undefined;
  return {
    activeTools: names.filter((name) => !isRetrievalToolName(name)),
    system: systemPrompt + FINAL_STEP_NOTE,
  };
}

/** Tools whose call is itself the reply, so the loop ends on them by design. */
const TURN_ENDING_TOOLS: ReadonlySet<string> = new Set([
  "done",
  ...Object.keys(studyTools),
]);

/**
 * Whether the agentic loop stopped before the model could answer from what it
 * last asked for. That happens two ways:
 *
 * - The last recorded step called a tool whose result the model never read:
 *   the capped step searched though it was told to answer, or the provider
 *   failed on the next step, which is then never recorded. This reads the
 *   step's tool calls, not its finish reason: OpenRouter passes upstream finish
 *   reasons through, and some upstreams report `stop` beside a tool call.
 * - The stream failed, and the last step wrote nothing before it did.
 *
 * Any text such a turn has is the line a model writes before calling a tool
 * ("Let me search more specifically for..."), and counting it as the answer
 * left students with only that line, turn after turn. A step that wrote text
 * and then failed is not cut off: that text is a partial answer, and a
 * fallback would put a second answer under it.
 *
 * One trade-off is deliberate. A model that answered in full early and then
 * searched until the cap also lands here, and gets a second answer. Telling
 * that apart from a one-line preamble is not reliable, a duplicate answer is a
 * smaller failure than no answer, and the final step's tool restriction makes
 * it rare.
 */
export function cutOffMidSearch(
  lastStep:
    | {
        toolCalls: ReadonlyArray<{ toolName: string }>;
        text: string;
        finishReason: FinishReason;
      }
    | undefined,
  streamErrored: boolean,
): boolean {
  if (!lastStep) return false;
  const unreadResult = lastStep.toolCalls.some(
    (tc) => !TURN_ENDING_TOOLS.has(tc.toolName),
  );
  const failedSilently =
    (streamErrored || lastStep.finishReason === "error") &&
    !lastStep.text.trim();
  return unreadResult || failedSilently;
}
