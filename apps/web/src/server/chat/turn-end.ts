import type { FinishReason } from "ai";
import { studyTools } from "./study-tools";
import type { StreamTail } from "./stream-filter";

/**
 * Steps the agentic loop may take. A turn that reaches the cap still searching
 * is answered by the fallback (see cutOffMidSearch).
 *
 * The capped step is not made to answer in-loop by taking the search tools
 * away. Tried live across every OpenRouter host: with only `showQuiz` left,
 * DeepSeek V3.2 on some hosts wrote "Let me search..." and called `showQuiz`
 * instead, which counts as an answer and suppresses the fallback (2 of 5 real
 * turns on one host); with no tools, or `toolChoice: "none"`, it and Llama 3.3
 * wrote their tool-call markup into the answer text. The fallback's request,
 * with no tools and no tool history, answered cleanly on the same hosts.
 */
export const MAX_AGENT_STEPS = 5;

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
 * When a failure ended the turn, it was cut off if the last step the stream
 * wrote has no text, or had started another search. A step that failed
 * before it streamed anything is never recorded, so that case is read off the
 * stream: when the error came after a finished step, `tail` still describes
 * that step, and a step that answered in text without searching ended the
 * turn there, so the failed request after it was not a cut-off. A step that
 * failed partway through writing text is a partial answer instead: a fallback
 * would put a second answer under it. So is a study tool already on screen (a
 * finished quiz is the reply); the fallback has no study tools and would write
 * the quiz out as prose beneath it.
 *
 * Otherwise it was cut off if the last step called a tool whose result the
 * model never read: the loop hit the step cap still searching. That reads the step's tool calls, not its finish reason: OpenRouter
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
 */
export function cutOffMidSearch(end: TurnEnd): boolean {
  if (primaryTurnFailed(end)) {
    if (end.tail.shownStudyTool) return false;
    // The request after a finished step failed before streaming: a cut-off
    // only if that step left something to read. Its own record says so best.
    if (end.tail.errorAfterLastStep && end.lastStep) {
      return leftResultsUnread(end.lastStep);
    }
    return !end.tail.stepText.trim() || end.tail.stepStartedSearch;
  }
  return leftResultsUnread(end.lastStep) || end.tail.stepStartedSearch;
}
