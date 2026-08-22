import {
  streamText,
  stepCountIs,
  hasToolCall,
  type FinishReason,
  type InferUIMessageChunk,
  type ModelMessage,
  type StepResult,
  type ToolSet,
  type UIMessageStreamWriter,
} from "ai";
import { nanoid } from "nanoid";
import { resolveModel, type OpenRouterClient } from "@teachanything/ai";
import { logError, logWarn } from "@/lib/logger";
import { repairQuiz } from "@/lib/quiz";
import type { StudyUIMessage } from "./study-tools";
import { stripRetrievalOutputs } from "./stream-filter";
import { recoverLeakedQuiz } from "./recover-quiz";
import {
  repairQuizToolParts,
  closeTruncatedQuizInputs,
} from "./repair-quiz-parts";

type Chunk = InferUIMessageChunk<StudyUIMessage>;

/**
 * Forward every chunk of `source` to the response, in order, and resolve once it
 * is drained. Chunks still stream live -- each is written the moment it arrives.
 *
 * This is deliberately not `writer.merge`. Merging returns immediately and lets
 * the pump forward chunks concurrently with the rest of `execute`, so a write
 * made after `await primary.text` can overtake chunks still in flight. That is
 * not hypothetical: with a quiz cut off at the token limit, the tail of the
 * stream IS that quiz's `tool-input-delta` chunks, and the closing
 * `tool-input-available` written afterwards was observed landing *before* them,
 * which re-opens the very "Building your quiz..." skeleton it exists to resolve.
 * The same inversion applies to the trailing `finish` chunk that carries sources
 * and the truncation notice. Draining here makes those writes strictly last.
 */
async function forward(
  writer: UIMessageStreamWriter<StudyUIMessage>,
  source: ReadableStream<Chunk>,
): Promise<void> {
  const reader = source.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return;
      writer.write(value);
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Run the primary turn: retrieval + study tools (or study-only / none).
 *
 * Streams every visible chunk into `writer` (drained via `forward`), then
 * resolves with the turn's final text and steps. The unawaited `finishReason`
 * promise is returned as-is so the caller can await it at its original point in
 * the sequence. `{ ok: false }` means the turn failed after streaming.
 */
export async function runPrimaryTurn(args: {
  aiClient: OpenRouterClient;
  modelId: ReturnType<typeof resolveModel>;
  systemPrompt: string;
  messages: ModelMessage[];
  tools: ToolSet;
  temperature: number;
  maxOutputTokens: number;
  abortSignal: AbortSignal;
  chatbotId: string;
  partialQuizInput: Map<string, string>;
  modelCanUseTools: boolean;
  onStreamError: (error: unknown) => string;
  writer: UIMessageStreamWriter<StudyUIMessage>;
}): Promise<
  | {
      ok: true;
      primaryText: string;
      primarySteps: Array<StepResult<ToolSet>>;
      finishReason: PromiseLike<FinishReason>;
    }
  | { ok: false }
> {
  const primary = streamText({
    model: args.aiClient.getModel(args.modelId),
    system: args.systemPrompt,
    messages: args.messages,
    tools: args.tools,
    // stepCountIs caps the agentic retrieval loop; hasToolCall("done") ends
    // it early when the model delivers a final answer via the `done` tool.
    // Harmless when `done` isn't in the toolset (never fires).
    stopWhen: [stepCountIs(5), hasToolCall("done")],
    temperature: args.temperature,
    maxOutputTokens: args.maxOutputTokens,
    abortSignal: args.abortSignal,
    // Fix a `showQuiz` call the model got structurally wrong BEFORE the SDK
    // rejects it. Repairing later (in the stream) is too late in two ways:
    // the student briefly sees the error notice, and the model is handed a
    // tool error, so it retries and the turn renders a second quiz.
    experimental_repairToolCall: async ({ toolCall }) => {
      if (toolCall.toolName !== "showQuiz") return null;
      const quiz = repairQuiz(toolCall.input);
      if (!quiz) return null;
      logWarn("Repaired a malformed showQuiz call", {
        chatbotId: args.chatbotId,
        modelId: args.modelId,
      });
      return { ...toolCall, input: JSON.stringify(quiz) };
    },
    onChunk({ chunk }) {
      if (chunk.type === "tool-input-start" && chunk.toolName === "showQuiz") {
        args.partialQuizInput.set(chunk.id, "");
      } else if (chunk.type === "tool-input-delta") {
        const written = args.partialQuizInput.get(chunk.id);
        if (written !== undefined) {
          args.partialQuizInput.set(chunk.id, written + chunk.delta);
        }
      }
    },
  });

  const primaryUiStream = primary
    .toUIMessageStream<StudyUIMessage>({
      sendReasoning: false,
      sendFinish: false,
      onError: args.onStreamError,
    })
    .pipeThrough(stripRetrievalOutputs())
    // Salvage a quiz the SDK rejected (input cut off at maxTokens, too many
    // questions, one botched question) into the questions that do render,
    // instead of showing the student an error. See repairQuizToolParts.
    .pipeThrough(repairQuizToolParts());
  // Study-tool-capable turns: reconstruct a quiz the model leaked as a text
  // JSON blob (instead of a native showQuiz call) into a real tool part, so
  // it renders as the widget rather than raw JSON. Only quiz-shaped text is
  // buffered; ordinary answers still stream live. See recoverLeakedQuiz.
  await forward(
    args.writer,
    args.modelCanUseTools
      ? primaryUiStream.pipeThrough(recoverLeakedQuiz())
      : primaryUiStream,
  );

  try {
    const [primaryText, primarySteps] = await Promise.all([
      primary.text,
      primary.steps,
    ]);
    return {
      ok: true,
      primaryText,
      primarySteps,
      finishReason: primary.finishReason,
    };
  } catch (error) {
    logError(error, "primary turn failed", { chatbotId: args.chatbotId });
    return { ok: false };
  }
}

/**
 * Close out every `showQuiz` input the token limit cut off mid-write, which
 * leaves the client with a "Building your quiz..." skeleton and nothing in
 * `steps`: resolve each to the questions that finished, or to an error when
 * none did. Returns whether any salvage produced a renderable quiz.
 */
export function salvageTruncatedQuizzes(
  partialQuizInput: Map<string, string>,
  toolCalls: ReadonlyArray<{ toolCallId: string }>,
  writer: UIMessageStreamWriter<StudyUIMessage>,
  logContext: { chatbotId: string; modelId: string; maxOutputTokens: number },
): boolean {
  const closing = closeTruncatedQuizInputs(
    partialQuizInput,
    toolCalls.map((tc) => tc.toolCallId),
  );
  let salvagedTruncatedQuiz = false;
  for (const chunk of closing) {
    writer.write(chunk);
    salvagedTruncatedQuiz ||= chunk.type === "tool-input-available";
    logWarn(
      chunk.type === "tool-input-available"
        ? "Quiz input truncated; salvaged the completed questions"
        : "Quiz input truncated with nothing to salvage",
      logContext,
    );
  }
  return salvagedTruncatedQuiz;
}

/**
 * If the model answered only through the `done` tool (no free text), surface
 * that answer as a text part so it renders and persists as text.
 *
 * This gate deliberately reads `primaryText` (the LAST step's text), not
 * `turnText`. `done` is a retrieval tool: its part is stripped from the
 * stream and from `persistedParts`, so an answer delivered through it is
 * invisible unless written out here. A model that narrates in an earlier
 * step ("Let me check the readings.") and then answers via `done` has a
 * non-empty `turnText` but an empty final step -- gating on `turnText`
 * there would swallow the answer entirely. `hasVisibleAnswer` below is
 * the opposite question ("did the turn produce anything at all?") and
 * correctly spans every step.
 */
export function writeDoneAnswerAsText(
  writer: UIMessageStreamWriter<StudyUIMessage>,
  primaryText: string,
  doneAnswer: string | undefined,
): void {
  if (doneAnswer && doneAnswer.trim() && !primaryText.trim()) {
    const id = nanoid();
    writer.write({ type: "text-start", id });
    writer.write({ type: "text-delta", id, delta: doneAnswer });
    writer.write({ type: "text-end", id });
  }
}

/**
 * Empty-response fallback (#357): a static, no-tools turn so the user always
 * gets an answer instead of a stuck, empty stream.
 */
export async function runFallbackTurn(args: {
  aiClient: OpenRouterClient;
  modelId: ReturnType<typeof resolveModel>;
  systemPrompt: string;
  messages: ModelMessage[];
  temperature: number;
  maxOutputTokens: number;
  abortSignal: AbortSignal;
  chatbotId: string;
  onStreamError: (error: unknown) => string;
  writer: UIMessageStreamWriter<StudyUIMessage>;
}): Promise<{ ok: true; finishReason: FinishReason } | { ok: false }> {
  const fallback = streamText({
    model: args.aiClient.getModel(args.modelId),
    system: args.systemPrompt,
    messages: args.messages,
    temperature: args.temperature,
    maxOutputTokens: args.maxOutputTokens,
    abortSignal: args.abortSignal,
  });
  try {
    // Drained rather than merged, so the trailing `finish` chunk (sources,
    // truncation notice) cannot overtake the answer's last tokens.
    await forward(
      args.writer,
      fallback.toUIMessageStream<StudyUIMessage>({
        sendReasoning: false,
        sendStart: false,
        sendFinish: false,
        onError: args.onStreamError,
      }),
    );
    await fallback.text;
    return { ok: true, finishReason: await fallback.finishReason };
  } catch (error) {
    logError(error, "fallback turn failed", { chatbotId: args.chatbotId });
    return { ok: false };
  }
}
