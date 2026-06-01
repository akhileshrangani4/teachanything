import { router, publicProcedure, protectedProcedure } from "../trpc";
import type { FinishReason } from "ai";
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
} from "@teachanything/ai";
import { logInfo, logError, logWarn } from "@/lib/logger";
import { env } from "@/lib/env";
import {
  checkRateLimit,
  authenticatedChatRateLimit,
  publicChatRateLimit,
} from "@/lib/rate-limit";
import { buildRAGContext } from "../rag-context";
import type { db as DbType } from "@teachanything/db";

/**
 * Clamp maxTokens to valid range (100-4000)
 */
function clampMaxTokens(maxTokens: number | null | undefined): number {
  const MIN_TOKENS = 100;
  const MAX_TOKENS = 4000;
  const DEFAULT_TOKENS = 2000;

  if (maxTokens == null || isNaN(maxTokens)) {
    return DEFAULT_TOKENS;
  }

  return Math.max(MIN_TOKENS, Math.min(MAX_TOKENS, maxTokens));
}

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

  // Send RAG sources now that they're available. The client handles metadata
  // events idempotently (updates only fields that are present).
  yield {
    type: "metadata" as const,
    sources: ragResult.sources,
  };

  // Build message history for AI (budget-trimmed)
  const conversationHistory = trimmedHistory.map((msg) => ({
    role: msg.role as "system" | "user" | "assistant",
    content: msg.content,
  }));

  // ragFailureNote + systemPrompt + fileManifest + contextText
  const systemPrompt =
    ragResult.ragFailureNote +
    chatbot.systemPrompt +
    ragResult.fileManifest +
    ragResult.contextText;

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

  // Stream response using the same client
  const startTime = Date.now();
  let fullResponse = "";
  let finishReason: FinishReason | undefined;

  const result = await aiClient.streamText({
    model: modelId,
    messages: [
      { role: "system", content: systemPrompt },
      ...conversationHistory,
      { role: "user", content: message },
    ],
    temperature: (chatbot.temperature ?? 70) / 100,
    maxTokens: maxOutputTokens,
  });

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
        fullResponse += part.text;
        thinkingEmitted = false;
        yield {
          type: "text" as const,
          content: part.text,
        };
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
        finishReason = part.finishReason;
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

  // Save assistant response
  await database.insert(messages).values({
    conversationId: conversation.id,
    role: "assistant",
    content: fullResponse,
    metadata: {
      sources: ragResult.sources,
      responseTime,
      ragUsed: ragResult.ragUsed,
    },
  });

  const ragSimilarityScore =
    ragResult.sources.length > 0
      ? Math.max(...ragResult.sources.map((source) => source.similarity))
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
