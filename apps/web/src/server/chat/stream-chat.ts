import {
  streamText,
  convertToModelMessages,
  stepCountIs,
  hasToolCall,
  createUIMessageStream,
  createUIMessageStreamResponse,
  type InferUIMessageChunk,
} from "ai";
import { eq, and, desc } from "drizzle-orm";
import { nanoid } from "nanoid";
import {
  createOpenRouterClient,
  resolveModel,
  MODEL_REGISTRY,
  calculateChunkLimit,
  allocateTokenBudget,
  CHARS_PER_TOKEN,
} from "@teachanything/ai";
import { modelSupportsTools } from "@teachanything/ai/models";
import {
  chatbots,
  conversations,
  messages,
  analytics,
  studyToolResponses,
} from "@teachanything/db/schema";
import type { db as DbType } from "@teachanything/db";
import { buildRAGContext, type RAGContextResult } from "@/server/rag-context";
import { createRetrievalTools } from "@/server/retrieval-tools";
import { maybeEnqueueReprocess } from "@/server/reprocess";
import { clampMaxTokens, mergeSources } from "@/server/chat-helpers";
import { env } from "@/lib/env";
import { logInfo, logError, logWarn } from "@/lib/logger";
import {
  studyTools,
  producedRenderableQuiz,
  buildStudyToolsAddendum,
  type StudyUIMessage,
  type StudyMessageMetadata,
} from "./study-tools";
import {
  rowToUIMessage,
  assistantMessageForDb,
  extractText,
  hasPersistableStudyPart,
  stripToolPartsForTextModel,
  PARTS_VERSION,
} from "./ui-messages";
import { stripRetrievalOutputs } from "./stream-filter";
import { recoverLeakedQuiz } from "./recover-quiz";
import {
  repairQuizToolParts,
  closeTruncatedQuizInputs,
} from "./repair-quiz-parts";
import { ChatRequestError } from "./request";
import { buildStudyResultsNote } from "@/server/study/model-note";
import { parseQuizFromText, repairQuiz } from "@/lib/quiz";

import { isRetrievalToolPart } from "@/lib/retrieval-tool-names";

/** Grounding rule ported verbatim from the agentic path in chat.ts. */
function buildGroundingRule(hasInjectedContext: boolean): string {
  return (
    "\n\nYou can search the attached documents using tools." +
    (hasInjectedContext
      ? " The passages above were already retrieved by searching the documents for the user's message; search again only when they are insufficient."
      : "") +
    " You MUST check the retrieved passages or call search_documents before stating whether the documents do or do not contain something. " +
    "If a search returns nothing, say you couldn't find it in the materials rather than denying it exists. " +
    "Do NOT put inline citations, source tags, page numbers, bracketed reference markers, or JSON anchors " +
    '(e.g. "(file.pdf, p. 2)" or "【…】") in your answer text -- the app shows the user the sources ' +
    "separately. Reply in clean prose."
  );
}

/** Generate a fresh session id (client-compatible: alnum, length 21). */
export function newSessionId(): string {
  return nanoid();
}

/**
 * Shared streaming orchestrator for both the authenticated and public chat
 * routes. Ports the current `processMessage`: conversation get/create, hybrid
 * RAG + agentic retrieval, token budgeting, history, persistence, analytics,
 * and lazy re-indexing -- but ends in a native `ai@6` UI message stream so the
 * model can render study tools (`showQuiz`) client-side.
 *
 * Behavior preserved from chat.ts:
 * - Agentic retrieval path (#357): retrieval tools + grounding rule + the
 *   `done` tool, with the empty-response fallback to a static (no-tools) turn.
 * - Study tools are always available on tool-capable models, even with zero
 *   files; retrieval tools require files + a healthy RAG pipeline.
 * - Retrieval tool RESULTS never reach the browser (privacy) and are stripped
 *   before persistence.
 */
/** Cap a single chat turn's generation. Kept below `maxDuration` (300s) so the
 * internal timeout fires before Vercel kills the function, giving `onFinish`
 * time to persist the partial turn. */
const STREAM_TIMEOUT_MS = 290_000;

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
  writer: { write: (chunk: InferUIMessageChunk<StudyUIMessage>) => void },
  source: ReadableStream<InferUIMessageChunk<StudyUIMessage>>,
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

export async function streamChat(params: {
  chatbot: typeof chatbots.$inferSelect;
  userMessage: StudyUIMessage;
  sessionId: string;
  db: typeof DbType;
  eventType: "message_sent" | "shared_message_sent";
  /** Request abort signal so a client disconnect / stop() halts generation. */
  signal?: AbortSignal;
}): Promise<Response> {
  const { chatbot, userMessage, sessionId, db: database, eventType } = params;

  // Stop the LLM when the client disconnects/aborts OR the turn runs too long.
  // Without this, an aborted request keeps the model generating server-side
  // (wasted spend), and a stalled upstream hangs the request off-Vercel.
  const timeoutSignal = AbortSignal.timeout(STREAM_TIMEOUT_MS);
  const abortSignal = params.signal
    ? AbortSignal.any([params.signal, timeoutSignal])
    : timeoutSignal;
  const messageText = extractText(userMessage.parts);

  // Get or create the conversation for this session.
  const existing = await database
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.chatbotId, chatbot.id),
        eq(conversations.sessionId, sessionId),
      ),
    )
    .limit(1);
  let conversation = existing[0];
  if (!conversation) {
    const [created] = await database
      .insert(conversations)
      .values({ chatbotId: chatbot.id, sessionId, metadata: {} })
      .onConflictDoNothing()
      .returning();
    conversation = created;
  }
  if (!conversation) {
    const [retry] = await database
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.chatbotId, chatbot.id),
          eq(conversations.sessionId, sessionId),
        ),
      )
      .limit(1);
    conversation = retry;
  }
  if (!conversation) {
    throw new ChatRequestError("Session id is already in use", 409);
  }
  const conversationId = conversation.id;

  // Lazily reprocess old files into page-aware chunks. Fire-and-forget (#271).
  void maybeEnqueueReprocess(database, chatbot.id);

  const modelId = resolveModel(chatbot.model);
  const { contextWindow } = MODEL_REGISTRY[modelId];
  const maxOutputTokens = clampMaxTokens(chatbot.maxTokens);
  const countTokens = await initTokenCounter();

  // Pass 1: estimate chunk limit before the RAG query.
  const systemPromptTokens = countTokens(chatbot.systemPrompt);
  const userMessageTokens = countTokens(messageText);
  const estimatedChunkLimit = calculateChunkLimit({
    contextWindow,
    maxOutputTokens,
    systemPromptTokens,
    fileManifestTokens: 0,
    userMessageTokens,
  });

  const aiClient = createOpenRouterClient(
    env.OPENROUTER_API_KEY,
    env.OPENAI_API_KEY,
  );

  // History + RAG + prior study-tool responses in parallel (bounded by the
  // slowest of the three).
  const [historyRows, ragResult, studyResponseRows] = await Promise.all([
    database
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(desc(messages.createdAt))
      .limit(50),
    buildRAGContext({
      chatbotId: chatbot.id,
      message: messageText,
      db: database,
      openrouterApiKey: env.OPENROUTER_API_KEY,
      openaiApiKey: env.OPENAI_API_KEY,
      chunkLimit: estimatedChunkLimit,
      aiClient,
    }),
    // Student responses to study tools shown earlier, so the model can be told
    // scores / unfinished quizzes. Small per conversation; ordered oldest-first
    // so attempts number naturally.
    database
      .select({
        toolCallId: studyToolResponses.toolCallId,
        toolName: studyToolResponses.toolName,
        response: studyToolResponses.response,
      })
      .from(studyToolResponses)
      .where(eq(studyToolResponses.conversationId, conversationId))
      .orderBy(studyToolResponses.createdAt)
      // Bounded so the results note can't balloon the prompt on a pathological
      // conversation; far above any realistic count of quiz attempts.
      .limit(200),
  ]);
  historyRows.reverse();

  // Group study responses by toolCallId for the model results note.
  const studyResponsesByToolCallId = new Map<
    string,
    Array<{ toolName: string; response: unknown }>
  >();
  for (const row of studyResponseRows) {
    const list = studyResponsesByToolCallId.get(row.toolCallId) ?? [];
    list.push({ toolName: row.toolName, response: row.response });
    studyResponsesByToolCallId.set(row.toolCallId, list);
  }

  // Pass 2: allocate budget with real token counts.
  const fileManifestTokens = countTokens(ragResult.fileManifest);
  const ragContextTokens = countTokens(ragResult.contextText);
  const ragFailureNoteTokens = countTokens(ragResult.ragFailureNote);
  const budget = allocateTokenBudget({
    contextWindow,
    maxOutputTokens,
    systemPromptTokens: systemPromptTokens + ragFailureNoteTokens,
    fileManifestTokens: fileManifestTokens + ragContextTokens,
    userMessageTokens,
    availableChunks: [],
    availableHistory: historyRows.map((m) => ({
      tokens: Math.ceil(m.content.length / CHARS_PER_TOKEN),
    })),
  });
  for (const warning of budget.warnings) {
    logWarn(warning, { chatbotId: chatbot.id, modelId });
  }
  const trimmedHistory =
    budget.historyLimit > 0
      ? historyRows.slice(historyRows.length - budget.historyLimit)
      : [];

  // Tool gate (capability follows tools):
  // - Study tools are ALWAYS on for tool-capable models, files or not.
  // - Retrieval tools require a tool-capable model, files, AND a healthy RAG
  //   pipeline (a ragFailureNote means embeddings are down -- tool searches
  //   would fail the same way, so we take the no-retrieval path whose prompt
  //   carries the failure note).
  const modelCanUseTools = modelSupportsTools(chatbot.model);
  const useRetrievalTools =
    modelCanUseTools &&
    ragResult.fileIds.length > 0 &&
    !ragResult.ragFailureNote;

  // Build retrieval tools once. `toolSources` accumulates as the tools run and
  // is read after streaming to merge into the final source list.
  let retrievalTools:
    | ReturnType<typeof createRetrievalTools>["tools"]
    | object = {};
  let toolSources: ReturnType<typeof createRetrievalTools>["sources"] = [];
  if (useRetrievalTools) {
    const rt = createRetrievalTools({
      db: database,
      fileIds: ragResult.fileIds,
      aiClient,
    });
    retrievalTools = rt.tools;
    toolSources = rt.sources;
  }

  const tools = useRetrievalTools
    ? { ...retrievalTools, ...studyTools }
    : modelCanUseTools
      ? { ...studyTools }
      : {};

  // System prompts. The primary (agentic) prompt carries the grounding rule +
  // study addendum when retrieval tools are on; otherwise it mirrors the static
  // path (failure note prepended, no grounding rule) plus the study addendum.
  // The fallback is the pure static prompt (no tools, no addendum).
  // History rows -> UIMessages. Built once here so the study-results note can be
  // derived from the full (pre-strip) history.
  const rawHistoryUiMessages = trimmedHistory.map(rowToUIMessage);

  // Tell the model how the student did on study tools shown earlier (quiz
  // scores per attempt, or "not yet answered"), since render-only tools return
  // no result to the model. Appended to whichever system prompt is used so it
  // reaches tool-capable and non-tool models alike.
  const studyResultsNote = buildStudyResultsNote(
    rawHistoryUiMessages,
    studyResponsesByToolCallId,
  );

  const studyAddendum = modelCanUseTools
    ? buildStudyToolsAddendum(maxOutputTokens, useRetrievalTools)
    : "";
  const primarySystemPrompt =
    (useRetrievalTools
      ? chatbot.systemPrompt +
        ragResult.fileManifest +
        ragResult.contextText +
        buildGroundingRule(Boolean(ragResult.contextText)) +
        studyAddendum
      : ragResult.ragFailureNote +
        chatbot.systemPrompt +
        ragResult.fileManifest +
        ragResult.contextText +
        studyAddendum) + studyResultsNote;
  const fallbackSystemPrompt =
    ragResult.ragFailureNote +
    chatbot.systemPrompt +
    ragResult.fileManifest +
    ragResult.contextText +
    studyResultsNote;

  // History -> ModelMessages, then append the new message. A non-tool model
  // (e.g. the bot was switched after a quiz was persisted) must not receive
  // tool-call messages, or the provider can 400 the turn, so down-convert any
  // persisted study-tool parts to text first.
  const historyUiMessages = modelCanUseTools
    ? rawHistoryUiMessages
    : rawHistoryUiMessages.map(stripToolPartsForTextModel);
  const uiMessages: StudyUIMessage[] = [...historyUiMessages, userMessage];
  const modelMessages = await convertToModelMessages(uiMessages, {
    tools,
    ignoreIncompleteToolCalls: true,
  });

  const temperature = (chatbot.temperature ?? 70) / 100;

  // Persist the user message up front; awaited before saving the assistant reply
  // so ordering stays correct. The `.catch` records the failure instead of
  // rethrowing so this promise never becomes a dangling rejection (onFinish may
  // await it seconds later, or never); onFinish checks the flag.
  let userInsertFailed = false;
  const userMessageInsert = database
    .insert(messages)
    .values({
      conversationId,
      role: "user",
      content: messageText,
      metadata: {},
    })
    .catch((err) => {
      userInsertFailed = true;
      logError(err, "Failed to insert user message", {
        chatbotId: chatbot.id,
        sessionId,
      });
    });

  const startTime = Date.now();

  // Metadata computed during `execute`, read in `onFinish` for persistence.
  let finalSources: RAGContextResult["sources"] = ragResult.sources;
  let ragUsedFlag = ragResult.ragUsed;
  let responseTime = 0;
  let truncated = false;
  let executeErrored = false;

  const onStreamError = (error: unknown): string => {
    logError(error, "stream error in streamChat", { chatbotId: chatbot.id });
    return "Failed to generate a response. Please try again.";
  };

  const stream = createUIMessageStream<StudyUIMessage>({
    originalMessages: uiMessages,
    onError: onStreamError,
    execute: async ({ writer }) => {
      // Partial `showQuiz` input, accumulated per tool call id. `maxTokens` caps
      // the whole turn, so a low setting can cut the model off mid-input; when
      // the args were streamed the SDK then forms no tool call at all, leaving
      // `steps` empty, so this is the only record of what the model wrote.
      const partialQuizInput = new Map<string, string>();

      // Primary turn: retrieval + study tools (or study-only / none).
      const primary = streamText({
        model: aiClient.getModel(modelId),
        system: primarySystemPrompt,
        messages: modelMessages,
        tools,
        // stepCountIs caps the agentic retrieval loop; hasToolCall("done") ends
        // it early when the model delivers a final answer via the `done` tool.
        // Harmless when `done` isn't in the toolset (never fires).
        stopWhen: [stepCountIs(5), hasToolCall("done")],
        temperature,
        maxOutputTokens,
        abortSignal,
        // Fix a `showQuiz` call the model got structurally wrong BEFORE the SDK
        // rejects it. Repairing later (in the stream) is too late in two ways:
        // the student briefly sees the error notice, and the model is handed a
        // tool error, so it retries and the turn renders a second quiz.
        experimental_repairToolCall: async ({ toolCall }) => {
          if (toolCall.toolName !== "showQuiz") return null;
          const quiz = repairQuiz(toolCall.input);
          if (!quiz) return null;
          logWarn("Repaired a malformed showQuiz call", {
            chatbotId: chatbot.id,
            modelId,
          });
          return { ...toolCall, input: JSON.stringify(quiz) };
        },
        onChunk({ chunk }) {
          if (
            chunk.type === "tool-input-start" &&
            chunk.toolName === "showQuiz"
          ) {
            partialQuizInput.set(chunk.id, "");
          } else if (chunk.type === "tool-input-delta") {
            const written = partialQuizInput.get(chunk.id);
            if (written !== undefined) {
              partialQuizInput.set(chunk.id, written + chunk.delta);
            }
          }
        },
      });

      const primaryUiStream = primary
        .toUIMessageStream<StudyUIMessage>({
          sendReasoning: false,
          sendFinish: false,
          onError: onStreamError,
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
        writer,
        modelCanUseTools
          ? primaryUiStream.pipeThrough(recoverLeakedQuiz())
          : primaryUiStream,
      );

      let primaryText: string;
      let primarySteps: Awaited<typeof primary.steps>;
      try {
        [primaryText, primarySteps] = await Promise.all([
          primary.text,
          primary.steps,
        ]);
      } catch {
        executeErrored = true;
        return;
      }
      // The turn's text, across every step. `primary.text` resolves to the LAST
      // step's text only, and this turn is deliberately multi-step
      // (`stopWhen` above), so a model that answers in an earlier step and ends
      // on a retrieval call -- or on the step cap -- reads as having produced
      // nothing. That false negative fired the empty-response fallback below,
      // appending a second, independently generated answer to a turn the
      // student had already seen answered. Fall back to `primaryText` so a
      // provider that leaves `step.text` unset can't regress this.
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

      // A quiz input the token limit cut off mid-write leaves the client with a
      // "Building your quiz..." skeleton and nothing in `steps`. Resolve every
      // such part to the questions that finished, or to an error when none did.
      const closing = closeTruncatedQuizInputs(
        partialQuizInput,
        allToolCalls.map((tc) => tc.toolCallId),
      );
      let salvagedTruncatedQuiz = false;
      for (const chunk of closing) {
        writer.write(chunk);
        salvagedTruncatedQuiz ||= chunk.type === "tool-input-available";
        logWarn(
          chunk.type === "tool-input-available"
            ? "Quiz input truncated; salvaged the completed questions"
            : "Quiz input truncated with nothing to salvage",
          { chatbotId: chatbot.id, modelId, maxOutputTokens },
        );
      }

      // If the model answered only through the `done` tool (no free text),
      // surface that answer as a text part so it renders and persists as text.
      //
      // This gate deliberately reads `primaryText` (the LAST step's text), not
      // `turnText`. `done` is a retrieval tool: its part is stripped from the
      // stream and from `persistedParts`, so an answer delivered through it is
      // invisible unless written out here. A model that narrates in an earlier
      // step ("Let me check the readings.") and then answers via `done` has a
      // non-empty `turnText` but an empty final step -- gating on `turnText`
      // there would swallow the answer entirely. `hasVisibleAnswer` below is
      // the opposite question ("did the turn produce anything at all?") and
      // correctly spans every step.
      if (doneAnswer && doneAnswer.trim() && !primaryText.trim()) {
        const id = nanoid();
        writer.write({ type: "text-start", id });
        writer.write({ type: "text-delta", id, delta: doneAnswer });
        writer.write({ type: "text-end", id });
      }

      const hasVisibleAnswer =
        Boolean(turnText.trim()) ||
        Boolean(doneAnswer?.trim()) ||
        producedQuiz ||
        salvagedTruncatedQuiz;

      let finishReason = await primary.finishReason;

      if (!hasVisibleAnswer && modelCanUseTools && !abortSignal.aborted) {
        // Empty-response safety net (#357): a tool-capable turn produced no
        // user-visible content in ANY step (searched then hit the step cap,
        // `done` with an empty answer, an invalid-only quiz, or a study-only
        // bot that emitted neither text nor a valid quiz). Gated on
        // `modelCanUseTools` -- not `useRetrievalTools` -- so the study-only
        // path (zero files, or RAG unhealthy) is covered too. Fall back to a
        // static, no-tools turn so the user always gets an answer instead of a
        // stuck, empty stream.
        logWarn(
          "Agentic path produced no text response; falling back to static RAG",
          { chatbotId: chatbot.id, modelId },
        );
        const fallback = streamText({
          model: aiClient.getModel(modelId),
          system: fallbackSystemPrompt,
          messages: modelMessages,
          temperature,
          maxOutputTokens,
          abortSignal,
        });
        try {
          // Drained rather than merged, so the trailing `finish` chunk (sources,
          // truncation notice) cannot overtake the answer's last tokens.
          await forward(
            writer,
            fallback.toUIMessageStream<StudyUIMessage>({
              sendReasoning: false,
              sendStart: false,
              sendFinish: false,
              onError: onStreamError,
            }),
          );
          await fallback.text;
          finishReason = await fallback.finishReason;
        } catch {
          executeErrored = true;
          return;
        }
        finalSources = ragResult.sources;
        ragUsedFlag = ragResult.ragUsed;
      } else {
        finalSources = useRetrievalTools
          ? mergeSources(ragResult.sources, toolSources)
          : ragResult.sources;
        ragUsedFlag = useRetrievalTools
          ? finalSources.length > 0
          : ragResult.ragUsed;
      }

      responseTime = Date.now() - startTime;
      truncated = finishReason === "length";
      if (truncated) {
        logWarn("Response truncated at maxTokens limit", {
          chatbotId: chatbot.id,
          modelId,
          maxOutputTokens,
        });
      }

      if (abortSignal.aborted) return;

      // Close the message with a single finish chunk carrying the per-message
      // metadata (sources / responseTime / truncated). Both sub-streams used
      // `sendFinish: false`, so this is the only finish event.
      const metadata: StudyMessageMetadata = {
        sources: finalSources,
        responseTime,
        truncated: truncated || undefined,
      };
      writer.write({ type: "finish", finishReason, messageMetadata: metadata });
    },
    onFinish: async ({ responseMessage }) => {
      // Strip retrieval-tool parts (raw chunk outputs) before persisting: the
      // professor dashboard viewer only needs text + study-tool parts.
      const persistedParts = responseMessage.parts.filter(
        (p) => !isRetrievalToolPart(p.type),
      );
      const { content, parts } = assistantMessageForDb({
        ...responseMessage,
        parts: persistedParts,
      });
      const hasStudyPart = hasPersistableStudyPart(parts);
      // A quiz the model leaked into the text channel (see `recoverLeakedQuiz`)
      // is quiz content too, even though it never became a tool part. Buffering
      // that leak is exactly what makes the turn look stalled, so it is the turn
      // a student is most likely to Stop -- and dropping it is what made a quiz
      // turn vanish from the professor's transcript entirely.
      const hasQuizContent =
        hasStudyPart || parseQuizFromText(content) !== null;

      // On a client disconnect, don't persist a partial assistant turn (or its
      // analytics) -- UNLESS it carries quiz content. The rendered quiz stays
      // interactive on screen after a Stop, and recording an attempt requires
      // the persisted part to validate against; skipping the persist would make
      // every submission for that quiz 404 forever. The user message was
      // already saved up front either way.
      const clientAborted = abortSignal.aborted && !timeoutSignal.aborted;
      if (clientAborted && !hasQuizContent) return;

      const interrupted =
        timeoutSignal.aborted || executeErrored || clientAborted;
      // If `execute` errored before setting responseTime, fall back to elapsed
      // time so we never persist/report a misleading 0.
      const finalResponseTime = responseTime || Date.now() - startTime;

      try {
        await userMessageInsert;
        // Ordering intent: if the user turn failed to persist, don't attach an
        // assistant reply (or analytics) to a missing turn.
        if (userInsertFailed) return;

        const inserts: PromiseLike<unknown>[] = [];

        // Persist when the model produced text OR a render-only study part
        // (a quiz-only turn has empty content but must be saved). A genuinely
        // empty turn is not persisted, so reloaded history has no blank bubble.
        if (content.trim() || hasStudyPart) {
          inserts.push(
            database.insert(messages).values({
              conversationId,
              role: "assistant",
              content,
              metadata: {
                parts,
                partsVersion: PARTS_VERSION,
                sources: finalSources,
                responseTime: finalResponseTime,
                ragUsed: ragUsedFlag,
                truncated: truncated || undefined,
                interrupted: interrupted || undefined,
              },
            }),
          );
        }

        if (!interrupted) {
          const ragSimilarityScore =
            finalSources.length > 0
              ? Math.max(...finalSources.map((s) => s.similarity))
              : undefined;
          inserts.push(
            database.insert(analytics).values({
              chatbotId: chatbot.id,
              eventType,
              eventData: {
                sessionId,
                responseTime: finalResponseTime,
                messageLength: messageText.length,
                responseLength: content.length,
                // Use the merged final sources (initial RAG + tool-retrieved) so an
                // agentic turn whose sources came only from tool calls isn't logged
                // as ragUsed:false / sourcesCount:0 alongside a real similarity.
                ragUsed: ragUsedFlag,
                ragSimilarityScore,
                sourcesCount: finalSources.length,
                question: messageText.slice(0, 500),
              },
              sessionId,
            }),
          );
        }

        await Promise.all(inserts);

        if (!interrupted) {
          logInfo("Chat message processed", {
            chatbotId: chatbot.id,
            sessionId,
            responseTime: finalResponseTime,
            eventType,
          });
        }
      } catch (err) {
        logError(err, "Failed to persist assistant message", {
          chatbotId: chatbot.id,
          sessionId,
        });
      }
    },
  });

  return createUIMessageStreamResponse({ stream });
}

/**
 * Cached token counter -- initialized once, reused across requests. Mirrors the
 * lazy tiktoken init in chat.ts (char/4 fallback if the encoder won't load).
 */
let counterPromise: Promise<(text: string) => number> | null = null;
async function initTokenCounter(): Promise<(text: string) => number> {
  if (!counterPromise) {
    counterPromise = (async () => {
      try {
        const { getEncoding } = await import("js-tiktoken");
        const encoder = getEncoding("o200k_base");
        return (text: string) => encoder.encode(text).length;
      } catch {
        logWarn("Failed to initialize tiktoken encoder, using char/4 fallback");
        return (text: string) => Math.ceil(text.length / CHARS_PER_TOKEN);
      }
    })();
  }
  return counterPromise;
}
