import { convertToModelMessages, createUIMessageStreamResponse } from "ai";
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
import { clampMaxTokens } from "@/lib/chat/helpers";
import { env } from "@/lib/env";
import { logError } from "@/lib/logger";
import { studyTools, type StudyUIMessage } from "./study-tools";
import { extractText } from "@/lib/chat/ui-messages";
import { initTokenCounter } from "./token-counter";
import { resolveConversation } from "./conversation-resolution";
import {
  fetchTurnContext,
  groupStudyResponsesByToolCallId,
  computeTrimmedHistory,
} from "./turn-context";
import { buildTurnPrompts, searchedPassageBudget } from "./prompt-assembly";
import { executeTurn, type TurnState } from "./turn-execution";
import { beginUserMessageInsert, persistTurn } from "./turn-persistence";
import { createAssistantMessageStream } from "./assistant-message-stream";
import type { RagTiming } from "./turn-timing";
import { claimTurn, type TurnLease } from "./turn-lease";
import { ChatRequestError } from "./request";

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

type StreamChatParams = {
  chatbot: typeof chatbots.$inferSelect;
  userMessage: StudyUIMessage;
  sessionId: string;
  db: typeof DbType;
  eventType: "message_sent" | "shared_message_sent";
  /** Request abort signal so a client disconnect / stop() halts generation. */
  signal?: AbortSignal;
};

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
 *
 * A session runs one turn at a time: while one is in flight, another throws
 * `ChatRequestError("turn_in_progress", 409)` (#465).
 */
export async function streamChat(params: StreamChatParams): Promise<Response> {
  // Turn clock. `startTime` below only starts at the stream, after retrieval,
  // so everything before it is measured from here (see turn-timing.ts).
  const turnStart = Date.now();

  // Get or create the conversation for this session.
  const conversation = await resolveConversation(
    params.db,
    params.chatbot.id,
    params.sessionId,
  );

  // Claimed before the history read: a second turn would otherwise build its
  // prompt from history missing the first turn's messages, and the two turns'
  // rows would interleave in the transcript.
  const lease = await claimTurn(params.db, conversation);
  if (!lease) throw new ChatRequestError("turn_in_progress", 409);
  releaseOnAbort(params.signal, lease);

  try {
    return await streamClaimedTurn(params, {
      conversationId: conversation.id,
      lease,
      turnStart,
    });
  } catch (error) {
    // Thrown before the stream exists, so its onFinish will never release.
    await lease.release();
    throw error;
  }
}

/**
 * Free the session the moment the client stops or disconnects, so Stop and an
 * immediate resend isn't refused while the aborted turn winds down.
 */
function releaseOnAbort(signal: AbortSignal | undefined, lease: TurnLease) {
  const release = () => void lease.release();
  if (signal?.aborted) release();
  else signal?.addEventListener("abort", release, { once: true });
}

async function streamClaimedTurn(
  params: StreamChatParams,
  turn: { conversationId: string; lease: TurnLease; turnStart: number },
): Promise<Response> {
  const { chatbot, userMessage, sessionId, db: database, eventType } = params;
  const { conversationId, lease, turnStart } = turn;

  // Stop the LLM when the client disconnects/aborts OR the turn runs too long.
  // Without this, an aborted request keeps the model generating server-side
  // (wasted spend), and a stalled upstream hangs the request off-Vercel.
  const timeoutSignal = AbortSignal.timeout(STREAM_TIMEOUT_MS);
  const abortSignal = params.signal
    ? AbortSignal.any([params.signal, timeoutSignal])
    : timeoutSignal;
  const messageText = extractText(userMessage.parts);

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

  const ragTiming: RagTiming = {};
  const contextStart = Date.now();
  const { historyRows, ragResult, studyResponseRows } = await fetchTurnContext({
    database,
    chatbotId: chatbot.id,
    conversationId,
    messageText,
    chunkLimit: estimatedChunkLimit,
    openrouterApiKey: env.OPENROUTER_API_KEY,
    openaiApiKey: env.OPENAI_API_KEY,
    aiClient,
    ragTiming,
  });
  const contextMs = Date.now() - contextStart;
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

  // Build retrieval tools once. `toolSources` and `toolPassages` accumulate as
  // the tools run: the sources merge into the final source list, and the
  // passages reach the fallback turn if one runs.
  let retrievalTools:
    ReturnType<typeof createRetrievalTools>["tools"] | undefined;
  let toolSources: ReturnType<typeof createRetrievalTools>["sources"] = [];
  let toolPassages: ReturnType<typeof createRetrievalTools>["passages"] = [];
  if (useRetrievalTools) {
    const rt = createRetrievalTools({
      db: database,
      fileIds: ragResult.fileIds,
      aiClient,
    });
    retrievalTools = rt.tools;
    toolSources = rt.sources;
    toolPassages = rt.passages;
  }

  // Study tools stay gated on tool capability (the doc contract above);
  // when neither tool group applies this collapses to an empty object,
  // matching the pre-refactor explicit branches.
  const tools = {
    ...(retrievalTools ?? {}),
    ...(modelCanUseTools ? studyTools : {}),
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

  // Room for the passages the agentic searches find, should the fallback
  // need them: they arrive after the budget above was spent. Only measured
  // when the fallback runs.
  const searchedPassageTokens = () =>
    searchedPassageBudget({
      contextWindow,
      maxOutputTokens,
      fallbackSystemPrompt,
      messages: modelMessages,
      countTokens,
    });

  const temperature = (chatbot.temperature ?? 70) / 100;

  const userMessageInsert = beginUserMessageInsert(database, {
    conversationId,
    content: messageText,
    chatbotId: chatbot.id,
    sessionId,
  });

  const startTime = Date.now();
  const preStreamMs = startTime - turnStart;

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

  const stream = createAssistantMessageStream({
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
        toolPassages,
        searchedPassageTokens,
        countTokens,
        onStreamError,
        startTime,
      }),
    // Runs on every stream exit: finish, model error and client abort.
    onFinish: async ({ responseMessage }) => {
      try {
        await persistTurn({
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
          modelId,
          timing: {
            preStreamMs,
            contextMs,
            ...ragTiming,
            firstTokenMs: turnState.firstTokenMs,
          },
        });
      } finally {
        await lease.release();
      }
    },
  });

  return createUIMessageStreamResponse({ stream });
}
