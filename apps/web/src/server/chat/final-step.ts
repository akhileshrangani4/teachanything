import type { FinishReason, ToolSet } from "ai";
import { isRetrievalToolName } from "@/lib/retrieval-tool-names";
import { studyTools } from "./study-tools";
import type { StreamTail } from "./stream-filter";

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
 *
 * `done` goes too, since it is in the retrieval set: the last step answers in
 * plain text. That is deliberate. A `done` answer written in the same step as
 * any text is dropped (see writeDoneAnswerAsText), and a model told it is on
 * its last step tends to write both.
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

/**
 * Tools whose call is itself the reply, so the loop ends on them by design:
 * `done` stops it by name, and study tools are render-only (no `execute`), so
 * there is no result to continue with. A study tool that gets an `execute`
 * would have to leave this set.
 */
const TURN_ENDING_TOOLS: ReadonlySet<string> = new Set([
  "done",
  ...Object.keys(studyTools),
]);

/** How the primary turn ended, as read by the two functions below. */
export type TurnEnd = {
  /** The last recorded step, or undefined when the stream itself failed. */
  lastStep:
    | {
        toolCalls: ReadonlyArray<{ toolName: string }>;
        text: string;
        finishReason: FinishReason;
      }
    | undefined;
  tail: StreamTail;
  /**
   * The stream failed outright (a dropped connection) rather than sending an
   * `error` chunk.
   */
  streamFailed: boolean;
};

/** The step called a tool whose result the model was meant to read next. */
function leftResultsUnread(step: TurnEnd["lastStep"]): boolean {
  return (step?.toolCalls ?? []).some(
    (tc) => !TURN_ENDING_TOOLS.has(tc.toolName),
  );
}

/**
 * Whether a failure ended the turn, as opposed to one the loop got past.
 *
 * Providers can send an `error` chunk and keep streaming (OpenRouter does for a
 * chunk it cannot parse), and the AI SDK moves on to the next step whenever the
 * step's tool calls ran. Only a failure in the last step, or one after it,
 * ended the turn. An error after the last step only counts when that step left
 * results to read: otherwise no further request was coming, and the step that
 * finished cleanly is the answer.
 */
export function primaryTurnFailed(end: TurnEnd): boolean {
  return (
    end.streamFailed ||
    end.lastStep?.finishReason === "error" ||
    (end.tail.errorAfterLastStep &&
      (!end.lastStep || leftResultsUnread(end.lastStep)))
  );
}

/**
 * Whether the agentic loop stopped before the model could answer from what it
 * last asked for. Any text such a turn has is the line a model writes before
 * calling a tool ("Let me search more specifically for..."), and counting it as
 * the answer left students with only that line, turn after turn.
 *
 * When a failure ended the turn, it was cut off if the step that failed wrote
 * nothing, or had started another search. A step that failed before it
 * streamed anything is never recorded, so that case is read off the stream. A
 * step that failed partway through writing text is a partial answer instead:
 * a fallback would put a second answer under it.
 *
 * Otherwise it was cut off if the last step called a tool whose result the
 * model never read, which means the capped step searched though it was told to
 * answer. That reads the step's tool calls, not its finish reason: OpenRouter
 * passes upstream finish reasons through, and some upstreams report `stop`
 * beside a tool call. A search the step began but never completed counts too:
 * OpenRouter emits a call only once its arguments parse, and drops one that
 * never does when the finish reason is `stop`, so it appears in no step.
 *
 * One trade-off is deliberate. A model that answered in full and then searched
 * again also lands here when the loop stops before it reads that search --
 * at the step cap, or because a later request fails or the connection drops
 * -- and gets a second answer. Telling that apart from a one-line preamble is
 * not reliable, and a duplicate answer is a smaller failure than no answer.
 * The final step's tool restriction makes the step-cap case rare; the failure
 * cases are as common as the failures.
 */
export function cutOffMidSearch(end: TurnEnd): boolean {
  if (primaryTurnFailed(end)) {
    // The request that failed never streamed, so it wrote nothing.
    if (end.tail.errorAfterLastStep) return true;
    return !end.tail.stepText.trim() || end.tail.stepStartedSearch;
  }
  return leftResultsUnread(end.lastStep) || end.tail.stepStartedSearch;
}
