import { router, protectedProcedure } from "../trpc";
import { z } from "zod";
import {
  chatbots,
  conversations,
  messages,
  analytics,
  user,
} from "@teachanything/db/schema";
import {
  eq,
  and,
  sql,
  gte,
  lte,
  desc,
  asc,
  count,
  inArray,
  ilike,
} from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { escapeLikePattern } from "@/server/utils";

function buildMessageStatsSubquery(
  db: typeof import("@teachanything/db").db,
  chatbotId: string,
) {
  return db
    .select({
      conversationId: messages.conversationId,
      messageCount: count().as("message_count"),
      firstUserMessage: sql<string | null>`(
        SELECT m2.content FROM ${messages} m2
        WHERE m2.conversation_id = ${messages.conversationId}
          AND m2.role = 'user'
        ORDER BY m2.created_at ASC
        LIMIT 1
      )`.as("first_user_message"),
      firstMessageAt: sql<Date>`MIN(${messages.createdAt})`.as(
        "first_message_at",
      ),
      lastMessageAt: sql<Date>`MAX(${messages.createdAt})`.as(
        "last_message_at",
      ),
    })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .where(eq(conversations.chatbotId, chatbotId))
    .groupBy(messages.conversationId)
    .as("msg_stats");
}

function formatPreview(firstUserMessage: string | null): string | null {
  if (!firstUserMessage) return null;
  return firstUserMessage.length > 100
    ? firstUserMessage.slice(0, 100) + "..."
    : firstUserMessage;
}

export const analyticsRouter = router({
  /**
   * Get chatbot statistics
   */
  getChatbotStats: protectedProcedure
    .input(z.object({ chatbotId: z.string().uuid() }))
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

      // Get total conversations
      const [conversationCount] = await ctx.db
        .select({ count: count() })
        .from(conversations)
        .where(eq(conversations.chatbotId, input.chatbotId));

      const totalConversations = conversationCount?.count || 0;

      // Get total messages
      const conversationIds = await ctx.db
        .select({ id: conversations.id })
        .from(conversations)
        .where(eq(conversations.chatbotId, input.chatbotId));

      let totalMessages = 0;
      if (conversationIds.length > 0) {
        const [messageCount] = await ctx.db
          .select({ count: count() })
          .from(messages)
          .where(
            sql`${messages.conversationId} IN (${conversationIds.map((c) => c.id).join(",")})`,
          );

        totalMessages = messageCount?.count || 0;
      }

      // Get average response time from analytics
      const analyticsData = await ctx.db
        .select()
        .from(analytics)
        .where(
          and(
            eq(analytics.chatbotId, input.chatbotId),
            eq(analytics.eventType, "message_sent"),
          ),
        );

      let avgResponseTime = 0;
      if (analyticsData.length > 0) {
        const responseTimes = analyticsData
          .map((a) => {
            // Type guard for eventData with responseTime
            const eventData = a.eventData as Record<string, unknown> | null;
            return eventData && typeof eventData.responseTime === "number"
              ? eventData.responseTime
              : null;
          })
          .filter((t): t is number => t !== null);

        if (responseTimes.length > 0) {
          const sum = responseTimes.reduce((a, b) => a + b, 0);
          avgResponseTime = Math.round(sum / responseTimes.length);
        }
      }

      return {
        totalConversations,
        totalMessages,
        avgResponseTime,
        ragUsagePercentage: 0, // Can be calculated if needed
      };
    }),

  /**
   * Get recent conversations for chatbot
   */
  getConversations: protectedProcedure
    .input(
      z.object({
        chatbotId: z.string().uuid(),
        limit: z.number().min(1).max(50).default(10),
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

      // Get recent conversations
      const recentConversations = await ctx.db
        .select()
        .from(conversations)
        .where(eq(conversations.chatbotId, input.chatbotId))
        .orderBy(desc(conversations.createdAt))
        .limit(input.limit);

      // Get message count for each conversation
      const conversationsWithCount = await Promise.all(
        recentConversations.map(async (conversation) => {
          const [msgCount] = await ctx.db
            .select({ count: count() })
            .from(messages)
            .where(eq(messages.conversationId, conversation.id));

          return {
            ...conversation,
            messageCount: msgCount?.count || 0,
          };
        }),
      );

      return conversationsWithCount;
    }),

  /**
   * Get message volume over time
   */
  getMessageVolume: protectedProcedure
    .input(
      z.object({
        chatbotId: z.string().uuid(),
        timeRange: z.enum(["day", "week", "month"]).default("week"),
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

      // Calculate date range
      const now = new Date();
      let startDate: Date;

      switch (input.timeRange) {
        case "day":
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case "week":
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "month":
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
      }

      // Get conversations in date range
      const conversationIds = await ctx.db
        .select({ id: conversations.id })
        .from(conversations)
        .where(
          and(
            eq(conversations.chatbotId, input.chatbotId),
            gte(conversations.createdAt, startDate),
          ),
        );

      if (conversationIds.length === 0) {
        return [];
      }

      // Get messages grouped by date
      const messagesData = await ctx.db
        .select({
          date: sql<string>`DATE(${messages.createdAt})`,
          count: count(),
        })
        .from(messages)
        .where(
          sql`${messages.conversationId} IN (${conversationIds.map((c) => c.id).join(",")})`,
        )
        .groupBy(sql`DATE(${messages.createdAt})`)
        .orderBy(sql`DATE(${messages.createdAt})`);

      // Format for chart (Recharts expects { date, count })
      return messagesData.map((row) => ({
        date: row.date,
        count: row.count,
      }));
    }),

  /**
   * Get total messages per 30 days for all user's chatbots
   * Supports pagination with offsetDays parameter
   */
  getTotalMessagesPerMonth: protectedProcedure
    .input(
      z.object({
        offsetDays: z.number().int().min(0).default(0), // Days to go back from today
      }),
    )
    .query(async ({ ctx, input }) => {
      // Get user's account creation date
      const [userRecord] = await ctx.db
        .select({ createdAt: user.createdAt })
        .from(user)
        .where(eq(user.id, ctx.session.user.id))
        .limit(1);

      if (!userRecord) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      const accountCreatedAt = userRecord.createdAt;

      // Get all chatbots for the user
      const userChatbots = await ctx.db
        .select({ id: chatbots.id })
        .from(chatbots)
        .where(eq(chatbots.userId, ctx.session.user.id));

      if (userChatbots.length === 0) {
        return {
          data: [],
          startDate: accountCreatedAt,
          endDate: accountCreatedAt,
        };
      }

      const chatbotIds = userChatbots.map((cb) => cb.id);

      // Get conversations for all user's chatbots
      const conversationResults = await ctx.db
        .select({ id: conversations.id })
        .from(conversations)
        .where(inArray(conversations.chatbotId, chatbotIds));

      if (conversationResults.length === 0) {
        return {
          data: [],
          startDate: accountCreatedAt,
          endDate: accountCreatedAt,
        };
      }

      const conversationIds = conversationResults.map((c) => c.id);

      // Calculate date range: 30 days ending at (today - offsetDays)
      // But don't go back further than account creation date
      const endDate = new Date();
      endDate.setDate(endDate.getDate() - input.offsetDays);
      endDate.setHours(23, 59, 59, 999); // End of day

      const startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - 29); // 30 days total (including end date)
      startDate.setHours(0, 0, 0, 0); // Start of day

      // Ensure we don't go back further than account creation date
      const accountCreatedAtDate = new Date(accountCreatedAt);
      accountCreatedAtDate.setHours(0, 0, 0, 0); // Start of day

      if (startDate < accountCreatedAtDate) {
        startDate.setTime(accountCreatedAtDate.getTime());
      }

      // If end date is before account creation, use account creation date
      if (endDate < accountCreatedAtDate) {
        endDate.setTime(accountCreatedAtDate.getTime());
        endDate.setHours(23, 59, 59, 999);
      }

      // Get messages grouped by day within the date range
      const messagesData = await ctx.db
        .select({
          date: sql<string>`DATE(${messages.createdAt})`,
          count: count(),
        })
        .from(messages)
        .where(
          and(
            inArray(messages.conversationId, conversationIds),
            gte(messages.createdAt, startDate),
            lte(messages.createdAt, endDate),
          ),
        )
        .groupBy(sql`DATE(${messages.createdAt})`)
        .orderBy(sql`DATE(${messages.createdAt})`);

      // Fill in missing days with 0 count, but only from startDate onwards
      const dataMap = new Map<string, number>(
        messagesData.map((row) => [row.date, Number(row.count)]),
      );
      const filledData: Array<{ date: string; count: number }> = [];

      // Calculate actual number of days to show (may be less than 30 if account is newer)
      const daysDiff = Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      const daysToShow = Math.min(30, daysDiff + 1); // +1 to include both start and end dates

      for (let i = 0; i < daysToShow; i++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(currentDate.getDate() + i);
        const dateStr = currentDate.toISOString().split("T")[0]!;
        filledData.push({
          date: dateStr,
          count: dataMap.get(dateStr) || 0,
        });
      }

      return {
        data: filledData,
        startDate,
        endDate,
        accountCreatedAt,
      };
    }),

  getConversationsList: protectedProcedure
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

      const msgStats = buildMessageStatsSubquery(ctx.db, input.chatbotId);

      const [totalResult] = await ctx.db
        .select({ count: count() })
        .from(conversations)
        .innerJoin(msgStats, eq(conversations.id, msgStats.conversationId))
        .where(eq(conversations.chatbotId, input.chatbotId));

      const totalCount = Number(totalResult?.count ?? 0);

      let orderByClause;
      switch (input.sortBy) {
        case "mostMessages":
          orderByClause = desc(msgStats.messageCount);
          break;
        case "longestDuration":
          orderByClause = desc(
            sql`${msgStats.lastMessageAt} - ${msgStats.firstMessageAt}`,
          );
          break;
        default:
          orderByClause = desc(conversations.createdAt);
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
        .innerJoin(msgStats, eq(conversations.id, msgStats.conversationId))
        .where(eq(conversations.chatbotId, input.chatbotId))
        .orderBy(orderByClause)
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
    }),

  getConversationMessages: protectedProcedure
    .input(
      z.object({
        chatbotId: z.string().uuid(),
        conversationId: z.string().uuid(),
        limit: z.number().min(1).max(200).default(100),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
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

      const [conversation] = await ctx.db
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.id, input.conversationId),
            eq(conversations.chatbotId, input.chatbotId),
          ),
        )
        .limit(1);

      if (!conversation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Conversation not found",
        });
      }

      const [totalResult] = await ctx.db
        .select({ count: count() })
        .from(messages)
        .where(eq(messages.conversationId, input.conversationId));

      const conversationMessages = await ctx.db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, input.conversationId))
        .orderBy(asc(messages.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return {
        messages: conversationMessages,
        conversation,
        totalCount: Number(totalResult?.count ?? 0),
      };
    }),

  searchConversations: protectedProcedure
    .input(
      z.object({
        chatbotId: z.string().uuid(),
        query: z.string().min(1).max(200),
        limit: z.number().min(1).max(50).default(20),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
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

      const matchingConversationIds = ctx.db
        .selectDistinct({ id: messages.conversationId })
        .from(messages)
        .innerJoin(conversations, eq(messages.conversationId, conversations.id))
        .where(
          and(
            eq(conversations.chatbotId, input.chatbotId),
            ilike(messages.content, `%${escapeLikePattern(input.query)}%`),
          ),
        );

      const msgStats = buildMessageStatsSubquery(ctx.db, input.chatbotId);

      const [totalResult] = await ctx.db
        .select({ count: count() })
        .from(conversations)
        .innerJoin(msgStats, eq(conversations.id, msgStats.conversationId))
        .where(
          and(
            eq(conversations.chatbotId, input.chatbotId),
            inArray(conversations.id, matchingConversationIds),
          ),
        );

      const totalCount = Number(totalResult?.count ?? 0);

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
        .innerJoin(msgStats, eq(conversations.id, msgStats.conversationId))
        .where(
          and(
            eq(conversations.chatbotId, input.chatbotId),
            inArray(conversations.id, matchingConversationIds),
          ),
        )
        .orderBy(desc(conversations.createdAt))
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
    }),
});
