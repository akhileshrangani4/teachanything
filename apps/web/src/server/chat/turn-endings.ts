import type {
  FinishReason,
  ModelMessage,
  ToolSet,
  UIMessageStreamWriter,
} from "ai";
import { resolveModel, type OpenRouterClient } from "@teachanything/ai";
import type { RAGContextResult } from "@/server/rag-context";
import { mergeSources } from "@/lib/chat/helpers";
import { createRetrievalTools } from "@/server/retrieval-tools";
import { logError, logWarn } from "@/lib/logger";
import type { StudyMessageMetadata, StudyUIMessage } from "./study-tools";
import { runFallbackTurn, salvageTruncatedQuizzes } from "./primary-turn";
import { cutOffMidSearch, primaryTurnFailed, type TurnEnd } from "./turn-end";
import { withSearchedPassages } from "./prompt-assembly";
import type { StreamTail } from "./stream-filter";

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

export type TurnArgs = {
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
  toolPassages: ReturnType<typeof createRetrievalTools>["passages"];
  /**
   * Tokens the fallback may spend on `toolPassages` (see withSearchedPassages).
   * A function because it tokenizes the whole fallback prompt, which only the
   * rare turn that falls back should pay for.
   */
  searchedPassageTokens: () => number;
  countTokens: (text: string) => number;
  onStreamError: (error: unknown) => string;
  startTime: number;
};

type Writer = UIMessageStreamWriter<StudyUIMessage>;

/**
 * End the turn as failed: mark it for persistence AND write an error part.
 *
 * Both halves matter. `createUIMessageStream` only synthesises an error part
 * when its `execute` promise REJECTS (`result.catch(...)` in the AI SDK); a
 * normal return ends the stream with no error and no finish chunk, so the
 * student's text just stops. Every exit that sets `executeErrored` therefore
 * has to write the part itself.
 *
 * `errorText` is for an error the stream already reported (and
 * `onStreamError` already logged); without it, `error` is logged and turned
 * into the student-facing text here.
 */
export function failTurn(
  args: {
    state: TurnState;
    writer: Writer;
    onStreamError: (error: unknown) => string;
  },
  error: unknown,
  errorText?: string,
): void {
  args.state.executeErrored = true;
  args.writer.write({
    type: "error",
    errorText: errorText ?? args.onStreamError(error),
  });
}

/**
 * The primary stream itself failed (a dropped connection, a broken transform).
 *
 * A quiz still being written is closed out, or the client shows "Building
 * your quiz..." forever, and the failure is reported: the fallback has no
 * study tools, so for a quiz request it would write the questions and answers
 * out as prose. Otherwise a turn that never got past a preamble still gets the
 * fallback; one that broke off mid-answer keeps that partial answer and the
 * error.
 */
export async function endFailedStream(
  args: TurnArgs,
  writer: Writer,
  partialQuizInput: Map<string, string>,
  failure: { error: unknown; tail: StreamTail },
): Promise<void> {
  if (partialQuizInput.size > 0) {
    salvageTruncatedQuizzes(partialQuizInput, [], writer, {
      chatbotId: args.chatbotId,
      modelId: args.modelId,
      maxOutputTokens: args.maxOutputTokens,
    });
    failTurn(args, failure.error);
    return;
  }
  const end = { lastStep: undefined, tail: failure.tail, streamFailed: true };
  if (
    args.modelCanUseTools &&
    !args.abortSignal.aborted &&
    cutOffMidSearch(end)
  ) {
    const finishReason = await answerWithFallback(args, writer, end);
    if (finishReason) finishTurn(args, writer, finishReason);
    return;
  }
  failTurn(args, failure.error);
}

/**
 * The turn's sources: the injected context's, plus what the retrieval tools
 * fetched -- all of it for the primary answer, and only the passages that fit
 * in the fallback's prompt for a fallback answer (see withSearchedPassages).
 */
export function recordSources(
  args: TurnArgs,
  toolSources: TurnArgs["toolSources"] = args.toolSources,
): void {
  args.state.finalSources = args.useRetrievalTools
    ? mergeSources(args.ragResult.sources, toolSources)
    : args.ragResult.sources;
  args.state.ragUsedFlag = args.useRetrievalTools
    ? args.state.finalSources.length > 0
    : args.ragResult.ragUsed;
}

/**
 * Empty-response safety net (#357): a tool-capable turn produced no
 * user-visible answer in ANY step (cut off mid-search, `done` with an empty
 * answer, an invalid-only quiz, or a study-only bot that emitted neither text
 * nor a valid quiz). Gated by the caller on `modelCanUseTools` -- not
 * `useRetrievalTools` -- so the study-only path (zero files, or RAG unhealthy)
 * is covered too. Answer with a static, no-tools turn so the user always gets
 * an answer instead of a stuck, empty stream. A held primary error is dropped
 * here: the fallback either answers or fails with its own error.
 *
 * Resolves to the fallback's finish reason, or undefined when the turn failed
 * (already marked and reported).
 */
export async function answerWithFallback(
  args: TurnArgs,
  writer: Writer,
  end: TurnEnd,
): Promise<FinishReason | undefined> {
  logWarn("Agentic path produced no answer; falling back to static RAG", {
    chatbotId: args.chatbotId,
    modelId: args.modelId,
    cutOffMidSearch: cutOffMidSearch(end),
    primaryFailed: primaryTurnFailed(end),
  });
  // The passages the agentic searches found, which the injected context may
  // have missed: without them the fallback cannot use them, even when one of
  // them is what the student needed.
  const { prompt, included } = withSearchedPassages(
    args.fallbackSystemPrompt,
    args.toolPassages,
    args.ragResult.chunkIds,
    { maxTokens: args.searchedPassageTokens(), countTokens: args.countTokens },
  );
  const fallback = await runFallbackTurn({
    aiClient: args.aiClient,
    modelId: args.modelId,
    systemPrompt: prompt,
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
    return undefined;
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
    return undefined;
  }
  const fitted = new Set(included.map((p) => p.chunkId));
  recordSources(
    args,
    args.toolSources.filter((s) => fitted.has(s.chunkId)),
  );
  return fallback.finishReason;
}

/** Record the turn's timing and close the message with its one finish chunk. */
export function finishTurn(
  args: TurnArgs,
  writer: Writer,
  finishReason: FinishReason,
): void {
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
