import {
  streamText,
  convertToModelMessages,
  stepCountIs,
  hasToolCall,
  createUIMessageStream,
  createUIMessageStreamResponse,
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
  STUDY_TOOLS_SYSTEM_ADDENDUM,
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
import { ChatRequestError } from "./request";
import { buildStudyResultsNote } from "@/server/study/model-note";

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

  const studyAddendum = modelCanUseTools ? STUDY_TOOLS_SYSTEM_ADDENDUM : "";
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
      });

      writer.merge(
        primary
          .toUIMessageStream<StudyUIMessage>({
            sendReasoning: false,
            sendFinish: false,
            onError: onStreamError,
          })
          .pipeThrough(stripRetrievalOutputs()),
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
      const allToolCalls = primarySteps.flatMap((s) => s.toolCalls ?? []);
      const doneCall = allToolCalls.find((tc) => tc.toolName === "done");
      const doneInput = doneCall?.input as { answer?: unknown } | undefined;
      const doneAnswer =
        typeof doneInput?.answer === "string" ? doneInput.answer : undefined;
      // Only a schema-valid showQuiz call counts as a visible answer; an
      // `invalid: true` call renders as an error, so it must not suppress the
      // fallback below.
      const producedQuiz = producedRenderableQuiz(allToolCalls);

      // If the model answered only through the `done` tool (no free text),
      // surface that answer as a text part so it renders and persists as text.
      if (doneAnswer && doneAnswer.trim() && !primaryText.trim()) {
        const id = nanoid();
        writer.write({ type: "text-start", id });
        writer.write({ type: "text-delta", id, delta: doneAnswer });
        writer.write({ type: "text-end", id });
      }

      const hasVisibleAnswer =
        Boolean(primaryText.trim()) ||
        Boolean(doneAnswer?.trim()) ||
        producedQuiz;

      let finishReason = await primary.finishReason;

      if (!hasVisibleAnswer && modelCanUseTools && !abortSignal.aborted) {
        // Empty-response safety net (#357): a tool-capable turn produced no
        // user-visible content (searched then hit the step cap, `done` with an
        // empty answer, an invalid-only quiz, or a study-only bot that emitted
        // neither text nor a valid quiz). Gated on `modelCanUseTools` -- not
        // `useRetrievalTools` -- so the study-only path (zero files, or RAG
        // unhealthy) is covered too. Fall back to a static, no-tools turn so the
        // user always gets an answer instead of a stuck, empty stream.
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
        writer.merge(
          fallback.toUIMessageStream<StudyUIMessage>({
            sendReasoning: false,
            sendStart: false,
            sendFinish: false,
            onError: onStreamError,
          }),
        );
        try {
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
      // On a client disconnect, don't persist a partial assistant turn (or its
      // analytics). The user message was already saved up front, so the turn
      // just has no reply.
      if (abortSignal.aborted && !timeoutSignal.aborted) return;

      const interrupted = timeoutSignal.aborted || executeErrored;

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
