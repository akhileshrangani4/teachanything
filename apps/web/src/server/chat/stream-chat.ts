import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
} from "ai";
import { nanoid } from "nanoid";
import {
  createOpenRouterClient,
  resolveModel,
  MODEL_REGISTRY,
  calculateChunkLimit,
} from "@teachanything/ai";
import { modelSupportsTools } from "@teachanything/ai/models";
import { chatbots } from "@teachanything/db/schema";
import type { db as DbType } from "@teachanything/db";
import { createRetrievalTools } from "@/server/retrieval-tools";
import { maybeEnqueueReprocess } from "@/server/reprocess";
import { clampMaxTokens } from "@/server/chat-helpers";
import { env } from "@/lib/env";
import { logError } from "@/lib/logger";
import { studyTools, type StudyUIMessage } from "./study-tools";
import { extractText } from "./ui-messages";
import { initTokenCounter } from "./token-counter";
import { resolveConversation } from "./conversation-resolution";
import {
  fetchTurnContext,
  groupStudyResponsesByToolCallId,
  computeTrimmedHistory,
} from "./turn-context";
import { buildTurnPrompts } from "./prompt-assembly";
import { executeTurn, type TurnState } from "./turn-execution";
import { beginUserMessageInsert, persistTurn } from "./turn-persistence";

/**
 * Cap a single chat turn's generation. Kept below `maxDuration` (300s) so the
 * internal timeout fires before Vercel kills the function, giving `onFinish`
 * time to persist the partial turn.
 */
const STREAM_TIMEOUT_MS = 290_000;

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
 * Behavior preserved from the pre-AI-SDK tRPC implementation:
 * - Agentic retrieval path (#357): retrieval tools + grounding rule + the
 *   `done` tool, with the empty-response fallback to a static (no-tools) turn.
 * - Study tools are always available on tool-capable models, even with zero
 *   files; retrieval tools require files + a healthy RAG pipeline.
 * - Retrieval tool RESULTS never reach the browser (privacy) and are stripped
 *   before persistence.
 */
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
  const conversation = await resolveConversation(
    database,
    chatbot.id,
    sessionId,
  );
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

  const { historyRows, ragResult, studyResponseRows } = await fetchTurnContext({
    database,
    chatbotId: chatbot.id,
    conversationId,
    messageText,
    chunkLimit: estimatedChunkLimit,
    openrouterApiKey: env.OPENROUTER_API_KEY,
    openaiApiKey: env.OPENAI_API_KEY,
    aiClient,
  });
  historyRows.reverse();

  const studyResponsesByToolCallId =
    groupStudyResponsesByToolCallId(studyResponseRows);

  const trimmedHistory = computeTrimmedHistory({
    countTokens,
    contextWindow,
    maxOutputTokens,
    systemPromptTokens,
    userMessageTokens,
    ragResult,
    historyRows,
    chatbotId: chatbot.id,
    modelId,
  });

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
    | undefined;
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

  // When neither tool group applies this collapses to an empty object,
  // matching the previous explicit branches.
  const tools = {
    ...(retrievalTools ?? {}),
    ...studyTools,
  };

  const { primarySystemPrompt, fallbackSystemPrompt, uiMessages } =
    buildTurnPrompts({
      chatbotSystemPrompt: chatbot.systemPrompt,
      ragResult,
      maxOutputTokens,
      modelCanUseTools,
      useRetrievalTools,
      trimmedHistory,
      userMessage,
      studyResponsesByToolCallId,
    });

  const modelMessages = await convertToModelMessages(uiMessages, {
    tools,
    ignoreIncompleteToolCalls: true,
  });

  const temperature = (chatbot.temperature ?? 70) / 100;

  const userMessageInsert = beginUserMessageInsert(database, {
    conversationId,
    content: messageText,
    chatbotId: chatbot.id,
    sessionId,
  });

  const startTime = Date.now();

  // Metadata computed during `execute`, read in `onFinish` for persistence.
  const turnState: TurnState = {
    finalSources: ragResult.sources,
    ragUsedFlag: ragResult.ragUsed,
    responseTime: 0,
    truncated: false,
    executeErrored: false,
  };

  const onStreamError = (error: unknown): string => {
    logError(error, "stream error in streamChat", { chatbotId: chatbot.id });
    return "Failed to generate a response. Please try again.";
  };

  const stream = createUIMessageStream<StudyUIMessage>({
    originalMessages: uiMessages,
    onError: onStreamError,
    execute: ({ writer }) =>
      executeTurn({
        state: turnState,
        writer,
        aiClient,
        modelId,
        primarySystemPrompt,
        fallbackSystemPrompt,
        modelMessages,
        tools,
        temperature,
        maxOutputTokens,
        abortSignal,
        chatbotId: chatbot.id,
        modelCanUseTools,
        useRetrievalTools,
        ragResult,
        toolSources,
        onStreamError,
        startTime,
      }),
    onFinish: ({ responseMessage }) =>
      persistTurn({
        responseMessage,
        database,
        conversationId,
        chatbotId: chatbot.id,
        sessionId,
        eventType,
        messageText,
        userMessageInsert,
        timedOut: timeoutSignal.aborted,
        clientAborted: abortSignal.aborted && !timeoutSignal.aborted,
        executeErrored: turnState.executeErrored,
        finalSources: turnState.finalSources,
        ragUsedFlag: turnState.ragUsedFlag,
        truncated: turnState.truncated,
        responseTime: turnState.responseTime,
        startTime,
      }),
  });

  return createUIMessageStreamResponse({ stream });
}
