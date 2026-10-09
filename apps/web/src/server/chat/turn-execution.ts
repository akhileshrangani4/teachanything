import { logWarn } from "@/lib/logger";
import { producedRenderableQuiz } from "./study-tools";
import { withFirstTextTimer } from "./turn-timing";
import {
  runPrimaryTurn,
  salvageTruncatedQuizzes,
  writeDoneAnswerAsText,
} from "./primary-turn";
import { cutOffMidSearch, primaryTurnFailed } from "./turn-end";
import {
  answerWithFallback,
  endFailedStream,
  failTurn,
  finishTurn,
  recordSources,
  type TurnArgs,
} from "./turn-endings";

export type { TurnState } from "./turn-endings";

/**
 * Run the streaming part of a chat turn against `writer`: the primary agentic
 * / study-tool generation, its quiz salvage paths, the empty-response
 * fallback, and the closing finish chunk.
 */
export async function executeTurn(args: TurnArgs): Promise<void> {
  // Partial `showQuiz` input, accumulated per tool call id until the call
  // completes. `maxTokens` caps the whole turn, so a low setting can cut the
  // model off mid-input; when the args were streamed the SDK then forms no
  // tool call at all, leaving `steps` empty, so this is the only record of
  // what the model wrote.
  const partialQuizInput = new Map<string, string>();

  const writer = withFirstTextTimer(args.writer, () => {
    args.state.firstTokenMs = Date.now() - args.startTime;
  });

  // Primary turn: retrieval + study tools (or study-only / none).
  const primaryOutcome = await runPrimaryTurn({
    aiClient: args.aiClient,
    modelId: args.modelId,
    systemPrompt: args.primarySystemPrompt,
    messages: args.modelMessages,
    tools: args.tools,
    temperature: args.temperature,
    maxOutputTokens: args.maxOutputTokens,
    abortSignal: args.abortSignal,
    chatbotId: args.chatbotId,
    partialQuizInput,
    modelCanUseTools: args.modelCanUseTools,
    onStreamError: args.onStreamError,
    writer,
  });
  if (!primaryOutcome.ok) {
    await endFailedStream(args, writer, partialQuizInput, primaryOutcome);
    return;
  }
  const tail = primaryOutcome.tail;
  const {
    primaryText,
    primarySteps,
    finishReason: primaryFinishReason,
  } = primaryOutcome;

  // The turn's text, across every step. `primary.text` resolves to the LAST
  // step's text only, and this turn is deliberately multi-step
  // (`stopWhen` above), so a model that answers in an earlier step and then
  // searches once more reads as having produced nothing. That false negative
  // fired the empty-response fallback below, appending a second,
  // independently generated answer to a turn the student had already seen
  // answered. Fall back to `primaryText` so a provider that leaves
  // `step.text` unset can't regress this.
  const stepsText = primarySteps.map((step) => step.text ?? "").join("");
  const turnText = stepsText.trim() ? stepsText : primaryText;

  const allToolCalls = primarySteps.flatMap((s) => s.toolCalls ?? []);
  const doneCall = allToolCalls.find((tc) => tc.toolName === "done");
  const doneInput = doneCall?.input as { answer?: unknown } | undefined;
  const doneAnswer =
    typeof doneInput?.answer === "string" ? doneInput.answer : undefined;
  // Only a quiz the client can render (as written, or after repair) counts
  // as a visible answer; one that renders as an error must not suppress the
  // fallback below.
  const producedQuiz = producedRenderableQuiz(allToolCalls);

  const salvagedTruncatedQuiz = salvageTruncatedQuizzes(
    partialQuizInput,
    allToolCalls,
    writer,
    {
      chatbotId: args.chatbotId,
      modelId: args.modelId,
      maxOutputTokens: args.maxOutputTokens,
    },
  );

  writeDoneAnswerAsText(writer, primaryText, doneAnswer);

  // Text from a turn cut off mid-search is the model's preamble to a tool
  // call, not an answer (see cutOffMidSearch).
  const end = {
    lastStep: primarySteps[primarySteps.length - 1],
    tail,
    streamFailed: false,
  };
  const hasVisibleAnswer =
    (Boolean(turnText.trim()) && !cutOffMidSearch(end)) ||
    Boolean(doneAnswer?.trim()) ||
    producedQuiz ||
    salvagedTruncatedQuiz;

  let finishReason = await primaryFinishReason;

  if (!hasVisibleAnswer && args.modelCanUseTools && !args.abortSignal.aborted) {
    const fallbackFinish = await answerWithFallback(args, writer, end);
    if (!fallbackFinish) return;
    finishReason = fallbackFinish;
  } else {
    if (primaryTurnFailed(end)) {
      // No fallback ran, so the held error is the student's only notice. It
      // was logged when the stream produced it; a step that ended in an error
      // without sending one is logged here.
      failTurn(
        args,
        new Error("Model stream ended in an error"),
        tail.errorText,
      );
      return;
    }
    if (tail.errorText !== undefined) {
      // The loop got past the error and answered; it was logged when the
      // stream produced it, and the student needs no toast over an answer.
      logWarn("Agentic turn answered after a model stream error", {
        chatbotId: args.chatbotId,
        modelId: args.modelId,
      });
    }
    recordSources(args);
  }

  finishTurn(args, writer, finishReason);
}
