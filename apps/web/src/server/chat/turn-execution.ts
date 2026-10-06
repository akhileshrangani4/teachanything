import type { ModelMessage, ToolSet, UIMessageStreamWriter } from "ai";
import { resolveModel, type OpenRouterClient } from "@teachanything/ai";
import type { RAGContextResult } from "@/server/rag-context";
import { mergeSources } from "@/lib/chat/helpers";
import { createRetrievalTools } from "@/server/retrieval-tools";
import { logError, logWarn } from "@/lib/logger";
import {
  producedRenderableQuiz,
  type StudyMessageMetadata,
  type StudyUIMessage,
} from "./study-tools";
import { withFirstTextTimer } from "./turn-timing";
import {
  runPrimaryTurn,
  runFallbackTurn,
  salvageTruncatedQuizzes,
  writeDoneAnswerAsText,
} from "./primary-turn";
import { MAX_AGENT_STEPS } from "./final-step";

type SourceList = RAGContextResult["sources"];

/**
 * Per-turn values computed during `execute` and read afterwards by persistence.
 * Held in one object so `executeTurn` can mutate them in place.
 */
export type TurnState = {
  finalSources: SourceList;
  ragUsedFlag: boolean;
  responseTime: number;
  truncated: boolean;
  executeErrored: boolean;
  /** Stream start to the first answer text (see turn-timing.ts). */
  firstTokenMs?: number;
};

/**
 * End the turn as failed: mark it for persistence AND write an error part.
 *
 * Both halves matter. `createUIMessageStream` only synthesises an error part
 * when its `execute` promise REJECTS (`result.catch(...)` in the AI SDK); a
 * normal return ends the stream with no error and no finish chunk, so the
 * student's text just stops. Every exit that sets `executeErrored` therefore
 * has to write the part itself.
 */
export function failTurn(
  args: {
    state: TurnState;
    writer: UIMessageStreamWriter<StudyUIMessage>;
    onStreamError: (error: unknown) => string;
  },
  error: unknown,
): void {
  args.state.executeErrored = true;
  args.writer.write({ type: "error", errorText: args.onStreamError(error) });
}

/**
 * Run the streaming part of a chat turn against `writer`: the primary agentic
 * / study-tool generation, its quiz salvage paths, the empty-response
 * fallback, and the closing finish chunk.
 */
export async function executeTurn(args: {
  state: TurnState;
  writer: UIMessageStreamWriter<StudyUIMessage>;
  aiClient: OpenRouterClient;
  modelId: ReturnType<typeof resolveModel>;
  primarySystemPrompt: string;
  fallbackSystemPrompt: string;
  modelMessages: ModelMessage[];
  tools: ToolSet;
  temperature: number;
  maxOutputTokens: number;
  abortSignal: AbortSignal;
  chatbotId: string;
  modelCanUseTools: boolean;
  useRetrievalTools: boolean;
  ragResult: RAGContextResult;
  toolSources: ReturnType<typeof createRetrievalTools>["sources"];
  onStreamError: (error: unknown) => string;
  startTime: number;
}): Promise<void> {
  // Partial `showQuiz` input, accumulated per tool call id. `maxTokens` caps
  // the whole turn, so a low setting can cut the model off mid-input; when
  // the args were streamed the SDK then forms no tool call at all, leaving
  // `steps` empty, so this is the only record of what the model wrote.
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
    failTurn(args, primaryOutcome.error);
    return;
  }
  const {
    primaryText,
    primarySteps,
    finishReason: primaryFinishReason,
    streamError,
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

  // The loop stopped before the model could read what it last asked for: the
  // provider failed mid-loop, or the capped step searched anyway (the final
  // step is meant to answer, see finalStepSettings). Text from such a turn is
  // the line a model writes before calling a tool -- "Let me search more
  // specifically for..." -- and counting it as the answer left students with
  // only that line, turn after turn.
  const lastStep = primarySteps[primarySteps.length - 1];
  const cutOffMidSearch =
    streamError !== undefined ||
    (primarySteps.length >= MAX_AGENT_STEPS &&
      lastStep?.finishReason === "tool-calls");

  const hasVisibleAnswer =
    (Boolean(turnText.trim()) && !cutOffMidSearch) ||
    Boolean(doneAnswer?.trim()) ||
    producedQuiz ||
    salvagedTruncatedQuiz;

  let finishReason = await primaryFinishReason;

  if (!hasVisibleAnswer && args.modelCanUseTools && !args.abortSignal.aborted) {
    // Empty-response safety net (#357): a tool-capable turn produced no
    // user-visible answer in ANY step (cut off mid-search as above, `done`
    // with an empty answer, an invalid-only quiz, or a study-only bot that
    // emitted neither text nor a valid quiz). Gated on `modelCanUseTools` --
    // not `useRetrievalTools` -- so the study-only path (zero files, or RAG
    // unhealthy) is covered too. Fall back to a static, no-tools turn so the
    // user always gets an answer instead of a stuck, empty stream. A held
    // primary error is dropped here: the fallback either answers or fails
    // with its own error.
    logWarn(
      "Agentic path produced no text response; falling back to static RAG",
      {
        chatbotId: args.chatbotId,
        modelId: args.modelId,
        cutOffMidSearch,
        primaryErrored: streamError !== undefined,
      },
    );
    const fallback = await runFallbackTurn({
      aiClient: args.aiClient,
      modelId: args.modelId,
      systemPrompt: args.fallbackSystemPrompt,
      messages: args.modelMessages,
      temperature: args.temperature,
      maxOutputTokens: args.maxOutputTokens,
      abortSignal: args.abortSignal,
      chatbotId: args.chatbotId,
      onStreamError: args.onStreamError,
      writer,
    });
    if (!fallback.ok) {
      failTurn(args, fallback.error);
      return;
    }
    // Both turns produced nothing user-visible. Ending with a normal
    // finish here would leave the student a silently dead turn — the
    // exact UX the fallback exists to prevent. Surface an error part
    // instead (mirrors the failed-primary path: no success finish).
    if (!fallback.text.trim()) {
      logError(
        new Error("Fallback turn also produced no text"),
        "empty response after fallback",
        { chatbotId: args.chatbotId, modelId: args.modelId },
      );
      failTurn(args, new Error("Model produced no response text"));
      return;
    }
    finishReason = fallback.finishReason;
    args.state.finalSources = args.ragResult.sources;
    args.state.ragUsedFlag = args.ragResult.ragUsed;
  } else {
    // No fallback ran, so the held error is the student's only notice.
    if (streamError !== undefined) {
      writer.write({ type: "error", errorText: streamError });
    }
    args.state.finalSources = args.useRetrievalTools
      ? mergeSources(args.ragResult.sources, args.toolSources)
      : args.ragResult.sources;
    args.state.ragUsedFlag = args.useRetrievalTools
      ? args.state.finalSources.length > 0
      : args.ragResult.ragUsed;
  }

  args.state.responseTime = Date.now() - args.startTime;
  args.state.truncated = finishReason === "length";
  if (args.state.truncated) {
    logWarn("Response truncated at maxTokens limit", {
      chatbotId: args.chatbotId,
      modelId: args.modelId,
      maxOutputTokens: args.maxOutputTokens,
    });
  }

  if (args.abortSignal.aborted) return;

  // Close the message with a single finish chunk carrying the per-message
  // metadata (sources / responseTime / truncated). Both sub-streams used
  // `sendFinish: false`, so this is the only finish event.
  const metadata: StudyMessageMetadata = {
    sources: args.state.finalSources,
    responseTime: args.state.responseTime,
    truncated: args.state.truncated || undefined,
  };
  writer.write({
    type: "finish",
    finishReason,
    messageMetadata: metadata,
  });
}
