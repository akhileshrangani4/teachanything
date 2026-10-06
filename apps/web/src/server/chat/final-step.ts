import type { ToolSet } from "ai";
import { isRetrievalToolName } from "@/lib/retrieval-tool-names";

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
