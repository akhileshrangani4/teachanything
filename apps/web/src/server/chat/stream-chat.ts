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
import { TRPCError } from "@trpc/server";
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
  STUDY_TOOLS_SYSTEM_ADDENDUM,
  type StudyUIMessage,
  type StudyMessageMetadata,
} from "./study-tools";
import {
  rowToUIMessage,
  assistantMessageForDb,
  extractText,
} from "./ui-messages";

/**
 * Retrieval tool names whose RESULTS (raw document chunks) must never reach the
 * browser -- especially on public/embed bots. Their tool *inputs* still stream
 * (they power the client "Searching documents…" status line); only outputs are
 * filtered. The same set is stripped from the persisted `metadata.parts`.
 */
const RETRIEVAL_TOOL_NAMES = new Set([
  "search_documents",
  "get_page",
  "get_context_around",
  "list_documents",
  "done",
]);

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

/**
 * Filter retrieval-tool RESULT chunks out of a UI message stream while letting
 * tool *inputs* (status-line data) and every other chunk through. Output chunks
 * carry only `toolCallId`, so retrieval call ids are tracked at
 * `tool-input-start` (which carries the tool name).
 */
function stripRetrievalOutputs(): TransformStream<
  InferUIMessageChunk<StudyUIMessage>,
  InferUIMessageChunk<StudyUIMessage>
> {
  const retrievalCallIds = new Set<string>();
  return new TransformStream({
    transform(chunk, controller) {
      if (
        chunk.type === "tool-input-start" &&
        RETRIEVAL_TOOL_NAMES.has(chunk.toolName)
      ) {
        retrievalCallIds.add(chunk.toolCallId);
      }
      const isRetrievalOutput =
        (chunk.type === "tool-output-available" ||
          chunk.type === "tool-output-error") &&
        retrievalCallIds.has(chunk.toolCallId);
      if (!isRetrievalOutput) controller.enqueue(chunk);
    },
  });
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
export async function streamChat(params: {
  chatbot: typeof chatbots.$inferSelect;
  userMessage: StudyUIMessage;
  sessionId: string;
  db: typeof DbType;
  eventType: "message_sent" | "shared_message_sent";
}): Promise<Response> {
  const { chatbot, userMessage, sessionId, db: database, eventType } = params;
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
      .returning();
    conversation = created;
  }
  if (!conversation) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to create conversation",
    });
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

  // History + RAG in parallel (bounded by the slower of the two).
  const [historyRows, ragResult] = await Promise.all([
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
  ]);
  historyRows.reverse();

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
  const studyAddendum = modelCanUseTools ? STUDY_TOOLS_SYSTEM_ADDENDUM : "";
  const primarySystemPrompt = useRetrievalTools
    ? chatbot.systemPrompt +
      ragResult.fileManifest +
      ragResult.contextText +
      buildGroundingRule(Boolean(ragResult.contextText)) +
      studyAddendum
    : ragResult.ragFailureNote +
      chatbot.systemPrompt +
      ragResult.fileManifest +
      ragResult.contextText +
      studyAddendum;
  const fallbackSystemPrompt =
    ragResult.ragFailureNote +
    chatbot.systemPrompt +
    ragResult.fileManifest +
    ragResult.contextText;

  // History rows -> UIMessages -> ModelMessages, then append the new message.
  const historyUiMessages = trimmedHistory.map(rowToUIMessage);
  const uiMessages: StudyUIMessage[] = [...historyUiMessages, userMessage];
  const modelMessages = await convertToModelMessages(uiMessages, {
    tools,
    ignoreIncompleteToolCalls: true,
  });

  const temperature = (chatbot.temperature ?? 70) / 100;

  // Persist the user message up front; awaited before saving the assistant reply
  // so ordering stays correct if either fails.
  const userMessageInsert = database
    .insert(messages)
    .values({
      conversationId,
      role: "user",
      content: messageText,
      metadata: { parts: userMessage.parts },
    })
    .catch((err) => {
      logError(err, "Failed to insert user message", {
        chatbotId: chatbot.id,
        sessionId,
      });
      throw err;
    });

  const startTime = Date.now();

  // Metadata computed during `execute`, read in `onFinish` for persistence.
  let finalSources: RAGContextResult["sources"] = ragResult.sources;
  let ragUsedFlag = ragResult.ragUsed;
  let responseTime = 0;
  let truncated = false;

  const stream = createUIMessageStream<StudyUIMessage>({
    originalMessages: uiMessages,
    onError: (error) => {
      logError(error, "stream error in streamChat", { chatbotId: chatbot.id });
      return "Failed to generate a response. Please try again.";
    },
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
      });

      writer.merge(
        primary
          .toUIMessageStream<StudyUIMessage>({
            sendReasoning: false,
            sendFinish: false,
          })
          .pipeThrough(stripRetrievalOutputs()),
      );

      const [primaryText, primarySteps] = await Promise.all([
        primary.text,
        primary.steps,
      ]);
      const allToolCalls = primarySteps.flatMap((s) => s.toolCalls ?? []);
      const doneCall = allToolCalls.find((tc) => tc.toolName === "done");
      const doneInput = doneCall?.input as { answer?: unknown } | undefined;
      const doneAnswer =
        typeof doneInput?.answer === "string" ? doneInput.answer : undefined;
      const producedQuiz = allToolCalls.some(
        (tc) => tc.toolName === "showQuiz",
      );

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

      if (!hasVisibleAnswer && useRetrievalTools) {
        // Empty-response safety net (#357): the agentic turn produced no
        // user-visible content (searched then hit the step cap, or `done` with
        // an empty answer). Fall back to a static, no-tools turn so the user
        // always gets an answer instead of a stuck, empty stream.
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
        });
        writer.merge(
          fallback.toUIMessageStream<StudyUIMessage>({
            sendReasoning: false,
            sendStart: false,
            sendFinish: false,
          }),
        );
        await fallback.text;
        finishReason = await fallback.finishReason;
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
      const persistedParts = responseMessage.parts.filter((p) => {
        const toolName = /^tool-(.+)$/.exec(p.type)?.[1];
        return !toolName || !RETRIEVAL_TOOL_NAMES.has(toolName);
      });
      const { content, parts } = assistantMessageForDb({
        ...responseMessage,
        parts: persistedParts,
      });
      const hasStudyPart = parts.some((p) => p.type.startsWith("tool-"));

      try {
        await userMessageInsert;

        // Persist when the model produced text OR a render-only study part
        // (a quiz-only turn has empty content but must be saved). A genuinely
        // empty turn is not persisted, so reloaded history has no blank bubble.
        if (content.trim() || hasStudyPart) {
          await database.insert(messages).values({
            conversationId,
            role: "assistant",
            content,
            metadata: {
              parts,
              sources: finalSources,
              responseTime,
              ragUsed: ragUsedFlag,
              truncated: truncated || undefined,
            },
          });
        }

        const ragSimilarityScore =
          finalSources.length > 0
            ? Math.max(...finalSources.map((s) => s.similarity))
            : undefined;
        await database.insert(analytics).values({
          chatbotId: chatbot.id,
          eventType,
          eventData: {
            sessionId,
            responseTime,
            messageLength: messageText.length,
            responseLength: content.length,
            ragUsed: ragResult.ragUsed,
            ragSimilarityScore,
            sourcesCount: ragResult.sources.length,
            question: messageText.slice(0, 500),
          },
          sessionId,
        });
        logInfo("Chat message processed", {
          chatbotId: chatbot.id,
          sessionId,
          responseTime,
          eventType,
        });
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
