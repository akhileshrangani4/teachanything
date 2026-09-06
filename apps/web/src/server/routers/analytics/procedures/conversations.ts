import { protectedProcedure } from "@/server/trpc";
import { z } from "zod";
import {
  conversations,
  messages,
  chatbots,
  studyToolResponses,
} from "@teachanything/db/schema";
import type { SQL } from "drizzle-orm";
import { eq, and, sql, desc, asc, inArray, ilike } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { escapeLikePattern, formatPreview } from "@/server/utils";
import { assertOwnedChatbot } from "@/server/queries/chatbot";
import {
  checkRateLimit,
  conversationSearchRateLimit,
} from "@/server/rate-limit";
import { buildMessageStatsSubquery } from "../helpers";

export const getConversationsListProcedure = protectedProcedure
  .input(
    z.object({
      chatbotId: z.string().uuid(),
      limit: z.number().min(1).max(50).default(20),
      offset: z.number().min(0).default(0),
      sortBy: z
        .enum(["recent", "mostMessages", "longestDuration"])
        .default("recent"),
    }),
  )
  .query(async ({ ctx, input }) => {
    await assertOwnedChatbot(ctx, input.chatbotId);

    const msgStats = buildMessageStatsSubquery(ctx.db, input.chatbotId);

    // Count has no join (1:1 subquery doesn't change row count on leftJoin,
    // and we don't filter by any msg_stats column here).
    const [totalResult] = await ctx.db
      .select({ count: sql<number>`count(*)::int` })
      .from(conversations)
      .where(eq(conversations.chatbotId, input.chatbotId));

    const totalCount = totalResult?.count ?? 0;

    let primaryOrder: SQL;
    switch (input.sortBy) {
      case "mostMessages":
        primaryOrder = desc(sql`COALESCE(${msgStats.messageCount}, 0)`);
        break;
      case "longestDuration":
        primaryOrder = desc(
          sql`COALESCE(${msgStats.lastMessageAt} - ${msgStats.firstMessageAt}, interval '0')`,
        );
        break;
      default:
        primaryOrder = desc(conversations.createdAt);
    }

    const results = await ctx.db
      .select({
        id: conversations.id,
        sessionId: conversations.sessionId,
        metadata: conversations.metadata,
        createdAt: conversations.createdAt,
        messageCount: msgStats.messageCount,
        firstUserMessage: msgStats.firstUserMessage,
        firstMessageAt: msgStats.firstMessageAt,
        lastMessageAt: msgStats.lastMessageAt,
      })
      .from(conversations)
      .leftJoin(msgStats, eq(conversations.id, msgStats.conversationId))
      .where(eq(conversations.chatbotId, input.chatbotId))
      .orderBy(
        primaryOrder,
        desc(conversations.createdAt),
        desc(conversations.id),
      )
      .limit(input.limit)
      .offset(input.offset);

    return {
      conversations: results.map((r) => ({
        id: r.id,
        sessionId: r.sessionId,
        metadata: r.metadata,
        createdAt: r.createdAt,
        messageCount: r.messageCount ?? 0,
        preview: formatPreview(r.firstUserMessage),
        firstMessageAt: r.firstMessageAt,
        lastMessageAt: r.lastMessageAt,
      })),
      totalCount,
    };
  });

export const getConversationMessagesProcedure = protectedProcedure
  .input(
    z.object({
      chatbotId: z.string().uuid(),
      conversationId: z.string().uuid(),
      limit: z.number().min(1).max(200).default(100),
      offset: z.number().min(0).default(0),
    }),
  )
  .query(async ({ ctx, input }) => {
    // Single JOIN verifies chatbot ownership AND conversation binding
    // in one round-trip.
    const [row] = await ctx.db
      .select({ conversation: conversations })
      .from(conversations)
      .innerJoin(chatbots, eq(chatbots.id, conversations.chatbotId))
      .where(
        and(
          eq(conversations.id, input.conversationId),
          eq(conversations.chatbotId, input.chatbotId),
          eq(chatbots.userId, ctx.session.user.id),
        ),
      )
      .limit(1);

    if (!row) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Conversation not found",
      });
    }

    const [totalResult] = await ctx.db
      .select({ count: sql<number>`count(*)::int` })
      .from(messages)
      .where(eq(messages.conversationId, input.conversationId));

    const conversationMessages = await ctx.db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, input.conversationId))
      .orderBy(asc(messages.createdAt))
      .limit(input.limit)
      .offset(input.offset);

    // Student study-tool attempts for this conversation (quiz answers, etc.),
    // in chronological order so the client can label them Attempt 1, 2, ...
    // per toolCallId. Loaded in full (not tied to the message page) so a quiz
    // on any message page shows all its attempts; responses per conversation
    // are small, but capped defensively against a pathological conversation.
    const studyResponses = await ctx.db
      .select({
        toolCallId: studyToolResponses.toolCallId,
        toolName: studyToolResponses.toolName,
        attempt: studyToolResponses.attempt,
        response: studyToolResponses.response,
      })
      .from(studyToolResponses)
      .where(eq(studyToolResponses.conversationId, input.conversationId))
      .orderBy(asc(studyToolResponses.createdAt))
      .limit(500);

    return {
      messages: conversationMessages,
      conversation: row.conversation,
      totalCount: totalResult?.count ?? 0,
      studyResponses,
    };
  });

export const searchConversationsProcedure = protectedProcedure
  .input(
    z.object({
      chatbotId: z.string().uuid(),
      query: z.string().min(1).max(200),
      limit: z.number().min(1).max(50).default(20),
      offset: z.number().min(0).default(0),
    }),
  )
  .query(async ({ ctx, input }) => {
    await assertOwnedChatbot(ctx, input.chatbotId);

    // ILIKE '%term%' is an unindexed scan without the pg_trgm GIN index,
    // and still expensive even with it. Cap per-user concurrency.
    const { success } = await checkRateLimit(
      conversationSearchRateLimit,
      ctx.session.user.id,
      { path: "analytics.searchConversations" },
    );
    if (!success) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "Too many search requests. Please slow down.",
      });
    }

    // Materialize matching ids once so the (expensive) ILIKE scan runs a
    // single time per request instead of once per downstream query. Cap
    // the materialized set so a chatbot with many matching conversations
    // can't balloon Node memory; user-facing pagination is capped at
    // `limit`, so more than a few thousand matches is never browsable.
    const SEARCH_MATCH_CAP = 5000;
    const matchingRows = await ctx.db
      .selectDistinct({ id: messages.conversationId })
      .from(messages)
      .innerJoin(conversations, eq(messages.conversationId, conversations.id))
      .where(
        and(
          eq(conversations.chatbotId, input.chatbotId),
          ilike(messages.content, `%${escapeLikePattern(input.query)}%`),
        ),
      )
      .limit(SEARCH_MATCH_CAP);

    if (matchingRows.length === 0) {
      return { conversations: [], totalCount: 0 };
    }

    const matchingIds = matchingRows.map((r) => r.id);
    const totalCount = matchingIds.length;

    const msgStats = buildMessageStatsSubquery(ctx.db, input.chatbotId);

    const results = await ctx.db
      .select({
        id: conversations.id,
        sessionId: conversations.sessionId,
        metadata: conversations.metadata,
        createdAt: conversations.createdAt,
        messageCount: msgStats.messageCount,
        firstUserMessage: msgStats.firstUserMessage,
        firstMessageAt: msgStats.firstMessageAt,
        lastMessageAt: msgStats.lastMessageAt,
      })
      .from(conversations)
      .leftJoin(msgStats, eq(conversations.id, msgStats.conversationId))
      .where(
        and(
          eq(conversations.chatbotId, input.chatbotId),
          inArray(conversations.id, matchingIds),
        ),
      )
      .orderBy(desc(conversations.createdAt), desc(conversations.id))
      .limit(input.limit)
      .offset(input.offset);

    return {
      conversations: results.map((r) => ({
        id: r.id,
        sessionId: r.sessionId,
        metadata: r.metadata,
        createdAt: r.createdAt,
        messageCount: r.messageCount ?? 0,
        preview: formatPreview(r.firstUserMessage),
        firstMessageAt: r.firstMessageAt,
        lastMessageAt: r.lastMessageAt,
      })),
      totalCount,
    };
  });

/**
 * Delete one or more conversations (and their messages, via cascade) for a
 * chatbot the caller owns. Used by the Student Chats tab to clear retry junk.
 */
export const deleteConversationsProcedure = protectedProcedure
  .input(
    z.object({
      chatbotId: z.string().uuid(),
      conversationIds: z.array(z.string().uuid()).min(1).max(100),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    await assertOwnedChatbot(ctx, input.chatbotId);

    // Scope the delete to this chatbot so a caller can't delete another
    // chatbot's conversations by id. Messages cascade-delete via FK.
    const deleted = await ctx.db
      .delete(conversations)
      .where(
        and(
          eq(conversations.chatbotId, input.chatbotId),
          inArray(conversations.id, input.conversationIds),
        ),
      )
      .returning({ id: conversations.id });

    return { deletedCount: deleted.length };
  });
