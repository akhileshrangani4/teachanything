import { router, publicProcedure, protectedProcedure } from "../trpc";
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
import { createOpenRouterClient, resolveModel } from "@teachanything/ai";
import { logInfo, logError } from "@/lib/logger";
import { env } from "@/lib/env";
import { buildRAGContext } from "../rag-context";

/**
 * Clamp maxTokens to valid range (100-4000)
 * Ensures runtime safety even if invalid data exists in database
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

export const chatRouter = router({
  /**
   * Send message to chatbot with streaming (protected - requires auth)
   */
  sendMessageStream: protectedProcedure
    .input(
      z.object({
        chatbotId: z.string().uuid(),
        message: z.string().min(1).max(16000),
        sessionId: z.string().optional(),
      }),
    )
    .subscription(async function* ({ ctx, input }) {
      try {
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

        // Generate or use existing sessionId
        const sessionId = input.sessionId || nanoid();

        // Get or create conversation
        const existingConversation = await ctx.db
          .select()
          .from(conversations)
          .where(
            and(
              eq(conversations.chatbotId, input.chatbotId),
              eq(conversations.sessionId, sessionId),
            ),
          )
          .limit(1);

        let conversation = existingConversation[0];

        if (!conversation) {
          const [newConv] = await ctx.db
            .insert(conversations)
            .values({
              chatbotId: input.chatbotId,
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

        // Get last 10 messages for context
        const historyMessages = await ctx.db
          .select()
          .from(messages)
          .where(eq(messages.conversationId, conversation.id))
          .orderBy(desc(messages.createdAt))
          .limit(10);

        historyMessages.reverse();

        // Build RAG context (file manifest, vector search, source attribution)
        const ragResult = await buildRAGContext({
          chatbotId: input.chatbotId,
          message: input.message,
          db: ctx.db,
          openrouterApiKey: env.OPENROUTER_API_KEY,
          openaiApiKey: env.OPENAI_API_KEY,
        });

        // Send metadata
        yield {
          type: "metadata" as const,
          sessionId,
          sources: ragResult.sources,
        };

        // Build message history for AI
        const conversationHistory = historyMessages.map((msg) => ({
          role: msg.role as "system" | "user" | "assistant",
          content: msg.content,
        }));

        // D-01: ragFailureNote + systemPrompt + fileManifest + contextText
        const systemPrompt =
          ragResult.ragFailureNote + chatbot.systemPrompt + ragResult.fileManifest + ragResult.contextText;

        // Save user message
        await ctx.db.insert(messages).values({
          conversationId: conversation.id,
          role: "user",
          content: input.message,
          metadata: {},
        });

        // Call OpenRouter with streaming
        const aiClient = createOpenRouterClient(
          env.OPENROUTER_API_KEY,
          env.OPENAI_API_KEY,
        );
        const startTime = Date.now();
        let fullResponse = "";

        const result = await aiClient.streamText({
          model: resolveModel(chatbot.model),
          messages: [
            { role: "system", content: systemPrompt },
            ...conversationHistory,
            { role: "user", content: input.message },
          ],
          temperature: (chatbot.temperature ?? 70) / 100,
          maxTokens: clampMaxTokens(chatbot.maxTokens),
        });

        // Stream the text
        for await (const chunk of result.textStream) {
          fullResponse += chunk;
          yield {
            type: "text" as const,
            content: chunk,
          };
        }

        const responseTime = Date.now() - startTime;

        // Save assistant response
        await ctx.db.insert(messages).values({
          conversationId: conversation.id,
          role: "assistant",
          content: fullResponse,
          metadata: {
            sources: ragResult.sources,
            responseTime,
            ragUsed: ragResult.ragUsed,
          },
        });

        // Track analytics
        await ctx.db.insert(analytics).values({
          chatbotId: input.chatbotId,
          eventType: "message_sent",
          eventData: {
            responseTime,
            messageLength: input.message.length,
            ragUsed: ragResult.ragUsed,
          },
          sessionId,
        });

        logInfo("Chat message processed", {
          chatbotId: input.chatbotId,
          sessionId,
          responseTime,
        });

        // Send done signal
        yield {
          type: "done" as const,
          responseTime,
        };
      } catch (error) {
        logError(error, "Error in sendMessageStream", {
          chatbotId: input.chatbotId,
          userId: ctx.session.user.id,
        });

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error ? error.message : "Failed to send message",
        });
      }
    }),

  /**
   * Send message to shared chatbot with streaming (public - no auth required)
   */
  sendSharedMessageStream: publicProcedure
    .input(
      z.object({
        shareToken: z.string(),
        message: z.string().min(1).max(16000),
        sessionId: z.string().optional(),
      }),
    )
    .subscription(async function* ({ ctx, input }) {
      try {
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

        // Generate or use existing sessionId
        const sessionId = input.sessionId || nanoid();

        // Get or create conversation
        const existingConversation = await ctx.db
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
          const [newConv] = await ctx.db
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

        // Get last 10 messages for context
        const historyMessages = await ctx.db
          .select()
          .from(messages)
          .where(eq(messages.conversationId, conversation.id))
          .orderBy(desc(messages.createdAt))
          .limit(10);

        historyMessages.reverse();

        // Build RAG context (file manifest, vector search, source attribution)
        const ragResult = await buildRAGContext({
          chatbotId: chatbot.id,
          message: input.message,
          db: ctx.db,
          openrouterApiKey: env.OPENROUTER_API_KEY,
          openaiApiKey: env.OPENAI_API_KEY,
        });

        // Send metadata
        yield {
          type: "metadata" as const,
          sessionId,
          sources: ragResult.sources,
        };

        // Build message history for AI
        const conversationHistory = historyMessages.map((msg) => ({
          role: msg.role as "system" | "user" | "assistant",
          content: msg.content,
        }));

        // D-01: ragFailureNote + systemPrompt + fileManifest + contextText
        const systemPrompt =
          ragResult.ragFailureNote + chatbot.systemPrompt + ragResult.fileManifest + ragResult.contextText;

        // Save user message
        await ctx.db.insert(messages).values({
          conversationId: conversation.id,
          role: "user",
          content: input.message,
          metadata: {},
        });

        // Call OpenRouter with streaming
        const aiClient = createOpenRouterClient(
          env.OPENROUTER_API_KEY,
          env.OPENAI_API_KEY,
        );
        const startTime = Date.now();
        let fullResponse = "";

        const result = await aiClient.streamText({
          model: resolveModel(chatbot.model),
          messages: [
            { role: "system", content: systemPrompt },
            ...conversationHistory,
            { role: "user", content: input.message },
          ],
          temperature: (chatbot.temperature ?? 70) / 100,
          maxTokens: clampMaxTokens(chatbot.maxTokens),
        });

        // Stream the text
        for await (const chunk of result.textStream) {
          fullResponse += chunk;
          yield {
            type: "text" as const,
            content: chunk,
          };
        }

        const responseTime = Date.now() - startTime;

        // Save assistant response
        await ctx.db.insert(messages).values({
          conversationId: conversation.id,
          role: "assistant",
          content: fullResponse,
          metadata: {
            sources: ragResult.sources,
            responseTime,
            ragUsed: ragResult.ragUsed,
          },
        });

        // Track analytics
        await ctx.db.insert(analytics).values({
          chatbotId: chatbot.id,
          eventType: "shared_message_sent",
          eventData: {
            responseTime,
            messageLength: input.message.length,
            ragUsed: ragResult.ragUsed,
          },
          sessionId,
        });

        logInfo("Shared chat message processed", {
          chatbotId: chatbot.id,
          sessionId,
          responseTime,
        });

        // Send done signal
        yield {
          type: "done" as const,
          responseTime,
        };
      } catch (error) {
        logError(error, "Error in sendSharedMessageStream", {
          shareToken: input.shareToken,
        });

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error ? error.message : "Failed to send message",
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
        sessionId: z.string(),
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
        sessionId: z.string(),
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

      // Delete messages (cascade will handle this if set up, but explicit is safer)
      await ctx.db
        .delete(messages)
        .where(eq(messages.conversationId, conversation.id));

      // Delete conversation
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
