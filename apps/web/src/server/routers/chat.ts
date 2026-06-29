import { router, publicProcedure, protectedProcedure } from "../trpc";
import type { FinishReason } from "ai";
import { stepCountIs, hasToolCall } from "ai";
import { modelSupportsTools } from "@teachanything/ai/models";
import { z } from "zod";
import {
  chatbots,
  conversations,
  messages,
  analytics,
} from "@teachanything/db/schema";
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
  type OpenRouterClient,
} from "@teachanything/ai";
import { logInfo, logError, logWarn } from "@/lib/logger";
import { env } from "@/lib/env";
import { maybeEnqueueReprocess } from "../reprocess";
import {
  checkRateLimit,
  authenticatedChatRateLimit,
  publicChatRateLimit,
} from "@/lib/rate-limit";
import { buildRAGContext, type RAGContextResult } from "../rag-context";
import { createRetrievalTools } from "../retrieval-tools";
import { clampMaxTokens, describeToolActivity } from "../chat-helpers";
import type { db as DbType } from "@teachanything/db";

/**
 * Cached token counter -- initialized once, reused across all requests.
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

/**
 * Shared streaming message processor used by both authenticated and public endpoints.
 * Handles: conversation management, token budgeting, RAG, streaming, persistence, analytics.
 */
async function* processMessage(params: {
  chatbot: typeof chatbots.$inferSelect;
  message: string;
  sessionId: string | undefined;
  db: typeof DbType;
  eventType: "message_sent" | "shared_message_sent";
}) {
  const { chatbot, message, db: database, eventType } = params;
  const sessionId = params.sessionId || nanoid();

  // Get or create conversation
  const existingConversation = await database
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.chatbotId, chatbot.id),
        eq(conversations.sessionId, sessionId),
      ),
    )
    .limit(1);

  let conversation = existingConversation[0];

  if (!conversation) {
    const [newConv] = await database
      .insert(conversations)
      .values({
        chatbotId: chatbot.id,
        sessionId,
        metadata: {},
      })
      .returning();
    conversation = newConv;
  }

  if (!conversation) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to create conversation",
    });
  }

  // Fire-and-forget: lazily reprocess any files ingested under an older
  // processing version so they gain page-aware chunks (#271). Must not block
  // the current turn — it serves immediately with whatever chunks exist.
  void maybeEnqueueReprocess(database, chatbot.id);

  // Yield the sessionId immediately so the client knows the subscription is
  // live before we start the expensive RAG embedding + history fetch. Sources
  // are sent as a second metadata event once RAG completes.
  yield {
    type: "metadata" as const,
    sessionId,
  };

  // Resolve model and get context window for budget allocation
  const modelId = resolveModel(chatbot.model);
  const { contextWindow } = MODEL_REGISTRY[modelId];
  const maxOutputTokens = clampMaxTokens(chatbot.maxTokens);

  // Initialize token counter
  const countTokens = await initTokenCounter();

  // Pass 1: estimate chunk limit before DB query
  const systemPromptTokens = countTokens(chatbot.systemPrompt);
  const userMessageTokens = countTokens(message);
  const estimatedChunkLimit = calculateChunkLimit({
    contextWindow,
    maxOutputTokens,
    systemPromptTokens,
    fileManifestTokens: 0,
    userMessageTokens,
  });

  // Create AI client once and reuse for both RAG embedding and LLM streaming
  const aiClient = createOpenRouterClient(
    env.OPENROUTER_API_KEY,
    env.OPENAI_API_KEY,
  );

  // History fetch and RAG context build are independent -- run in parallel so
  // we're bounded by the slower of the two (usually RAG) instead of their sum.
  const [historyMessages, ragResult] = await Promise.all([
    database
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversation.id))
      .orderBy(desc(messages.createdAt))
      .limit(50),
    buildRAGContext({
      chatbotId: chatbot.id,
      message,
      db: database,
      openrouterApiKey: env.OPENROUTER_API_KEY,
      openaiApiKey: env.OPENAI_API_KEY,
      chunkLimit: estimatedChunkLimit,
      aiClient,
    }),
  ]);

  historyMessages.reverse();

  // Pass 2: allocate budget with actual token counts
  const fileManifestTokens = countTokens(ragResult.fileManifest);
  const ragContextTokens = countTokens(ragResult.contextText);
  const ragFailureNoteTokens = countTokens(ragResult.ragFailureNote);

  const budget = allocateTokenBudget({
    contextWindow,
    maxOutputTokens,
    systemPromptTokens: systemPromptTokens + ragFailureNoteTokens,
    // RAG context already fetched; pass its tokens as part of fixed budget
    fileManifestTokens: fileManifestTokens + ragContextTokens,
    userMessageTokens,
    availableChunks: [],
    // Use char/4 estimate for history to avoid encoding 50 messages via tiktoken.
    // Exact counting is unnecessary here -- this is a budget allocation, not billing.
    availableHistory: historyMessages.map((m) => ({
      tokens: Math.ceil(m.content.length / CHARS_PER_TOKEN),
    })),
  });

  // Trim history to budget (keep newest messages)
  const trimmedHistory =
    budget.historyLimit > 0
      ? historyMessages.slice(historyMessages.length - budget.historyLimit)
      : [];

  // Log truncation warnings
  for (const warning of budget.warnings) {
    logWarn(warning, { chatbotId: chatbot.id, modelId });
  }

  // Tool-capable models with at least one searchable file use the AGENTIC
  // retrieval path: the model calls retrieval tools mid-turn instead of
  // receiving statically-injected chunks. Everything else uses the STATIC
  // path (today's behavior).
  const useTools =
    modelSupportsTools(chatbot.model) && ragResult.fileIds.length > 0;

  // Send RAG sources now that they're available (static path only). The
  // agentic path's sources aren't known until its tools run, so it emits its
  // own metadata event after streaming. The client handles metadata events
  // idempotently (updates only fields that are present).
  if (!useTools) {
    yield {
      type: "metadata" as const,
      sources: ragResult.sources,
    };
  }

  // Build message history for AI (budget-trimmed)
  // Stored conversation turns are only user/assistant; the system prompt is
  // passed separately via the streamText `system` option.
  const conversationHistory = trimmedHistory.map((msg) => ({
    role: msg.role as "user" | "assistant",
    content: msg.content,
  }));

  // Kick off the user-message insert alongside the streamText handshake
  // instead of blocking on it first. We await it before saving the assistant
  // reply so ordering stays correct if either fails.
  // The .catch keeps an unhandled rejection from surfacing if the stream
  // throws before we await; the real error is still logged here.
  const userMessageInsert = database
    .insert(messages)
    .values({
      conversationId: conversation.id,
      role: "user",
      content: message,
      metadata: {},
    })
    .catch((err) => {
      logError(err, "Failed to insert user message", {
        chatbotId: chatbot.id,
        sessionId,
      });
      throw err;
    });

  const startTime = Date.now();

  /**
   * STATIC retrieval path: inject RAG chunks into the system prompt and stream
   * a single LLM turn. Behaviorally identical to the pre-agentic chat flow.
   * Used directly for non-tool models and as the zero-tool-call fallback for
   * tool models. Yields the same wire events as the agentic path and returns
   * the accumulated response + finish reason.
   */
  async function* streamStatic(): AsyncGenerator<
    { type: "text"; content: string } | { type: "thinking" },
    { fullResponse: string; finishReason: FinishReason | undefined },
    void
  > {
    // ragFailureNote + systemPrompt + fileManifest + contextText
    const systemPrompt =
      ragResult.ragFailureNote +
      chatbot.systemPrompt +
      ragResult.fileManifest +
      ragResult.contextText;

    const result = await aiClient.streamText({
      model: modelId,
      system: systemPrompt,
      messages: [...conversationHistory, { role: "user", content: message }],
      temperature: (chatbot.temperature ?? 70) / 100,
      maxTokens: maxOutputTokens,
    });

    let staticResponse = "";
    let staticFinishReason: FinishReason | undefined;

    // Consume fullStream so we get typed events: text deltas, reasoning deltas,
    // errors, aborts, and finish reasons. textStream swallows all non-text parts,
    // which means mid-stream errors look identical to a clean finish on the wire.
    //
    // Emit at most one `thinking` event per reasoning phase: reasoning-delta
    // fires for every token and would spam the subscription otherwise.
    let thinkingEmitted = false;
    for await (const part of result.fullStream) {
      switch (part.type) {
        case "text-delta": {
          staticResponse += part.text;
          thinkingEmitted = false;
          yield { type: "text" as const, content: part.text };
          break;
        }
        case "reasoning-start":
        case "reasoning-delta": {
          // Surface reasoning as a thinking indicator so the UI doesn't look
          // frozen during long pauses. The reasoning text itself is never sent
          // to the client -- on public shared chatbots it can restate system
          // prompts or RAG context.
          if (!thinkingEmitted) {
            yield { type: "thinking" as const };
            thinkingEmitted = true;
          }
          break;
        }
        case "reasoning-end":
        case "text-start":
        case "text-end":
        case "finish-step": {
          // Any phase boundary closes the current reasoning phase so the next
          // reasoning-start/delta will re-emit the indicator.
          thinkingEmitted = false;
          break;
        }
        case "finish": {
          thinkingEmitted = false;
          staticFinishReason = part.finishReason;
          break;
        }
        case "error": {
          throw new Error(`Stream error: ${String(part.error)}`, {
            cause: part.error,
          });
        }
        case "abort": {
          throw new Error("Stream aborted by provider");
        }
        default:
          // Other event types (start, etc.) don't affect what we send to the
          // client.
          break;
      }
    }

    return { fullResponse: staticResponse, finishReason: staticFinishReason };
  }

  /**
   * AGENTIC retrieval path: give the model retrieval tools and let it search
   * the attached documents during the turn. No static context injection; the
   * model is forced to call `search_documents` on the first step. Yields the
   * same wire events as the static path. Returns the accumulated response,
   * finish reason, whether any tool call happened, and a captured `done`
   * answer (the `done` tool has no execute -- its answer lives in the
   * tool-call args).
   */
  async function* streamAgentic(): AsyncGenerator<
    | { type: "text"; content: string }
    | { type: "thinking" }
    | { type: "status"; label: string },
    {
      fullResponse: string;
      finishReason: FinishReason | undefined;
      anyToolCall: boolean;
    },
    void
  > {
    const nemotronPrefix = modelId.includes("nemotron")
      ? "detailed thinking on\n\n"
      : "";
    const groundingRule =
      "\n\nYou can search the attached documents using tools. You MUST call search_documents before stating whether the documents do or do not contain something. " +
      "Never say 'the document does not mention X' -- if a search returns nothing, say 'I couldn't find that in the materials.' " +
      "Cite the file name and page number for each claim, and include the exact quote you relied on.";
    const systemPrompt =
      nemotronPrefix +
      chatbot.systemPrompt +
      ragResult.fileManifest +
      groundingRule;

    const result = await aiClient.streamText({
      model: modelId,
      system: systemPrompt,
      messages: [...conversationHistory, { role: "user", content: message }],
      temperature: (chatbot.temperature ?? 70) / 100,
      maxTokens: maxOutputTokens,
      // apps/web resolves `ai` to a different installed copy than
      // @teachanything/ai does, so the `Tool` types are nominally distinct
      // across the wrapper boundary (identical runtime shape, different
      // package instances of @ai-sdk/provider-utils). Cast to the wrapper's
      // own expected tools type. Runtime behavior is unchanged.
      tools: tools as unknown as Parameters<
        OpenRouterClient["streamText"]
      >[0]["tools"],
      stopWhen: [stepCountIs(6), hasToolCall("done")],
      prepareStep: async ({ stepNumber }) =>
        stepNumber === 0
          ? {
              toolChoice: { type: "tool", toolName: "search_documents" },
              activeTools: ["search_documents"],
            }
          : {},
    });

    let agenticResponse = "";
    let agenticFinishReason: FinishReason | undefined;
    let anyToolCall = false;
    let doneAnswer: string | undefined;

    let thinkingEmitted = false;

    for await (const part of result.fullStream) {
      switch (part.type) {
        case "text-delta": {
          agenticResponse += part.text;
          thinkingEmitted = false;
          yield { type: "text" as const, content: part.text };
          break;
        }
        case "reasoning-start":
        case "reasoning-delta": {
          if (!thinkingEmitted) {
            yield { type: "thinking" as const };
            thinkingEmitted = true;
          }
          break;
        }
        case "reasoning-end":
        case "text-start":
        case "text-end":
        case "finish-step": {
          thinkingEmitted = false;
          break;
        }
        case "tool-input-start": {
          // A tool call is being assembled. The richer `status` event is
          // emitted on `tool-call` (below) once the tool name + args are known.
          anyToolCall = true;
          break;
        }
        case "tool-call": {
          anyToolCall = true;
          thinkingEmitted = false;
          // The `done` tool has no execute; its answer is in the tool-call
          // args (`part.input`), never a tool-result. It's not a retrieval
          // action, so it gets no status label.
          if (part.toolName === "done") {
            const input = part.input as { answer?: unknown } | undefined;
            if (typeof input?.answer === "string") {
              doneAnswer = input.answer;
            }
            break;
          }
          // Surface the tool activity as a human-readable status line. The
          // `part.input` is the parsed args object (AI SDK v6 TypedToolCall).
          // Only the action label + user-derived query are sent -- never tool
          // RESULT content, which could contain document text on public bots.
          yield {
            type: "status" as const,
            label: describeToolActivity(part.toolName, part.input),
          };
          break;
        }
        case "tool-result": {
          break;
        }
        case "finish": {
          thinkingEmitted = false;
          agenticFinishReason = part.finishReason;
          break;
        }
        case "error": {
          throw new Error(`Stream error: ${String(part.error)}`, {
            cause: part.error,
          });
        }
        case "abort": {
          throw new Error("Stream aborted by provider");
        }
        default:
          break;
      }
    }

    // If the model only spoke through the `done` tool (no free-text), surface
    // its answer as the response.
    if (!agenticResponse && doneAnswer) {
      agenticResponse = doneAnswer;
      yield { type: "text" as const, content: doneAnswer };
    }

    return {
      fullResponse: agenticResponse,
      finishReason: agenticFinishReason,
      anyToolCall,
    };
  }

  // Build retrieval tools once (only the agentic path consumes them, but
  // `toolSources` accumulates as the tools run and we read it after streaming).
  const { tools, sources: toolSources } = createRetrievalTools({
    db: database,
    fileIds: ragResult.fileIds,
    aiClient,
  });

  let fullResponse: string;
  let finishReason: FinishReason | undefined;
  // Final source list for persistence + the metadata event. Static path uses
  // ragResult.sources; agentic path maps toolSources (which carry pageNumber).
  // similarity is coerced from null -> 0 so existing consumers (which expect a
  // number and dedupe/score on it) keep working.
  let finalSources: RAGContextResult["sources"];
  let ragUsedFlag: boolean;

  if (useTools) {
    const agentic = yield* streamAgentic();

    // Empty-response safety net: the agentic path produced no user-visible
    // text (e.g. it only ran searches then hit the step cap, or called `done`
    // with an empty answer). Fall back to the static injection path so the user
    // always gets an answer instead of an empty, stuck-looking stream.
    if (!agentic.fullResponse) {
      logWarn(
        "Agentic path produced no text response; falling back to static RAG",
        {
          chatbotId: chatbot.id,
          modelId,
          anyToolCall: agentic.anyToolCall,
        },
      );
      // Emit RAG sources for the fallback path (agentic suppressed them above).
      yield { type: "metadata" as const, sources: ragResult.sources };
      const fallback = yield* streamStatic();
      fullResponse = fallback.fullResponse;
      finishReason = fallback.finishReason;
      finalSources = ragResult.sources;
      ragUsedFlag = ragResult.ragUsed;
    } else {
      fullResponse = agentic.fullResponse;
      finishReason = agentic.finishReason;
      finalSources = toolSources.map((s) => ({
        fileName: s.fileName,
        chunkIndex: s.chunkIndex,
        similarity: s.similarity ?? 0,
        pageNumber: s.pageNumber,
      }));
      ragUsedFlag = finalSources.length > 0;
      // Agentic sources are only known after the tools run, so emit them now.
      yield { type: "metadata" as const, sources: finalSources };
    }
  } else {
    const staticResult = yield* streamStatic();
    fullResponse = staticResult.fullResponse;
    finishReason = staticResult.finishReason;
    finalSources = ragResult.sources;
    ragUsedFlag = ragResult.ragUsed;
  }

  const responseTime = Date.now() - startTime;
  const truncated = finishReason === "length";

  if (truncated) {
    logWarn("Response truncated at maxTokens limit", {
      chatbotId: chatbot.id,
      modelId,
      maxOutputTokens,
    });
  }

  // Wait for the user message insert (fired in parallel with streamText) so
  // subsequent turns see the full conversation and the ordering is correct.
  await userMessageInsert;

  // Save the assistant reply only when the model actually produced text. The
  // model decides its own wording (the agentic loop falls back to the static
  // RAG path, so a "couldn't find it" answer is the model's own phrasing, not a
  // canned string). A genuinely empty turn is not persisted, so reloaded
  // history never shows a blank bubble.
  if (fullResponse.trim()) {
    await database.insert(messages).values({
      conversationId: conversation.id,
      role: "assistant",
      content: fullResponse,
      metadata: {
        sources: finalSources,
        responseTime,
        ragUsed: ragUsedFlag,
      },
    });
  }

  const ragSimilarityScore =
    finalSources.length > 0
      ? Math.max(...finalSources.map((source) => source.similarity))
      : undefined;

  // Track analytics
  await database.insert(analytics).values({
    chatbotId: chatbot.id,
    eventType,
    eventData: {
      sessionId,
      responseTime,
      messageLength: message.length,
      responseLength: fullResponse.length,
      ragUsed: ragResult.ragUsed,
      ragSimilarityScore,
      sourcesCount: ragResult.sources.length,
      question: message.slice(0, 500),
    },
    sessionId,
  });

  logInfo("Chat message processed", {
    chatbotId: chatbot.id,
    sessionId,
    responseTime,
    eventType,
  });

  // Send done signal. `truncated` surfaces whether the model hit its output
  // token limit so the UI can render a warning badge on the message.
  yield {
    type: "done" as const,
    responseTime,
    truncated,
  };
}

export const chatRouter = router({
  /**
   * Send message to chatbot with streaming (protected - requires auth)
   */
  sendMessageStream: protectedProcedure
    .input(
      z.object({
        chatbotId: z.string().uuid(),
        message: z.string().min(1).max(16000),
        sessionId: z
          .string()
          .min(10)
          .max(30)
          .regex(/^[a-zA-Z0-9_-]+$/)
          .optional(),
      }),
    )
    .subscription(async function* ({ ctx, input }) {
      try {
        // Rate limit per user
        const { success } = await checkRateLimit(
          authenticatedChatRateLimit,
          ctx.session.user.id,
        );
        if (!success) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: "Too many messages. Please slow down.",
          });
        }

        // Get chatbot
        const [chatbot] = await ctx.db
          .select()
          .from(chatbots)
          .where(
            and(
              eq(chatbots.id, input.chatbotId),
              eq(chatbots.userId, ctx.session.user.id),
            ),
          )
          .limit(1);

        if (!chatbot) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Chatbot not found",
          });
        }

        yield* processMessage({
          chatbot,
          message: input.message,
          sessionId: input.sessionId,
          db: ctx.db,
          eventType: "message_sent",
        });
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        logError(error, "Error in sendMessageStream", {
          chatbotId: input.chatbotId,
          userId: ctx.session.user.id,
        });

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to send message",
        });
      }
    }),

  /**
   * Send message to shared chatbot with streaming (public - no auth required)
   */
  sendSharedMessageStream: publicProcedure
    .input(
      z.object({
        shareToken: z.string().min(1).max(100),
        message: z.string().min(1).max(16000),
        sessionId: z
          .string()
          .min(10)
          .max(30)
          .regex(/^[a-zA-Z0-9_-]+$/)
          .optional(),
      }),
    )
    .subscription(async function* ({ ctx, input }) {
      try {
        // Rate limit by IP + share token (public endpoint, no userId available)
        const clientIp =
          ctx.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          "unknown";
        const { success } = await checkRateLimit(
          publicChatRateLimit,
          `${input.shareToken}:${clientIp}`,
        );
        if (!success) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: "Too many messages. Please slow down.",
          });
        }

        // Get chatbot by share token
        const [chatbot] = await ctx.db
          .select()
          .from(chatbots)
          .where(
            and(
              eq(chatbots.shareToken, input.shareToken),
              eq(chatbots.sharingEnabled, true),
            ),
          )
          .limit(1);

        if (!chatbot) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Chatbot not found or sharing is disabled",
          });
        }

        yield* processMessage({
          chatbot,
          message: input.message,
          sessionId: input.sessionId,
          db: ctx.db,
          eventType: "shared_message_sent",
        });
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        logError(error, "Error in sendSharedMessageStream", {
          shareToken: input.shareToken,
        });

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to send message",
        });
      }
    }),

  /**
   * Get conversation history
   */
  getHistory: protectedProcedure
    .input(
      z.object({
        chatbotId: z.string().uuid(),
        sessionId: z.string().min(1).max(100),
        limit: z.number().min(1).max(100).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Verify chatbot ownership
      const [chatbot] = await ctx.db
        .select()
        .from(chatbots)
        .where(
          and(
            eq(chatbots.id, input.chatbotId),
            eq(chatbots.userId, ctx.session.user.id),
          ),
        )
        .limit(1);

      if (!chatbot) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Chatbot not found",
        });
      }

      // Get conversation
      const [conversation] = await ctx.db
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.chatbotId, input.chatbotId),
            eq(conversations.sessionId, input.sessionId),
          ),
        )
        .limit(1);

      if (!conversation) {
        return {
          messages: [],
          sessionId: input.sessionId,
        };
      }

      // Get messages
      const conversationMessages = await ctx.db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, conversation.id))
        .orderBy(messages.createdAt)
        .limit(input.limit);

      return {
        messages: conversationMessages,
        sessionId: input.sessionId,
      };
    }),

  /**
   * Delete conversation
   */
  deleteConversation: protectedProcedure
    .input(
      z.object({
        chatbotId: z.string().uuid(),
        sessionId: z.string().min(1).max(100),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Verify chatbot ownership
      const [chatbot] = await ctx.db
        .select()
        .from(chatbots)
        .where(
          and(
            eq(chatbots.id, input.chatbotId),
            eq(chatbots.userId, ctx.session.user.id),
          ),
        )
        .limit(1);

      if (!chatbot) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Chatbot not found",
        });
      }

      // Get conversation
      const [conversation] = await ctx.db
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.chatbotId, input.chatbotId),
            eq(conversations.sessionId, input.sessionId),
          ),
        )
        .limit(1);

      if (!conversation) {
        return { success: true };
      }

      // Delete conversation (messages cascade-delete via FK onDelete: "cascade")
      await ctx.db
        .delete(conversations)
        .where(eq(conversations.id, conversation.id));

      logInfo("Conversation deleted", {
        chatbotId: input.chatbotId,
        sessionId: input.sessionId,
      });

      return { success: true };
    }),
});
