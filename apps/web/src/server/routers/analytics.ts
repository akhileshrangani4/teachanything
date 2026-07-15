import { router, protectedProcedure } from "../trpc";
import { z } from "zod";
import {
  chatbots,
  conversations,
  messages,
  analytics,
  user,
} from "@teachanything/db/schema";
import type { SQL } from "drizzle-orm";
import { eq, and, sql, gte, lte, desc, asc, inArray, ilike } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { escapeLikePattern, formatPreview } from "@/server/utils";
import type { Context } from "@/server/trpc";
import {
  checkRateLimit,
  conversationSearchRateLimit,
  downloadRateLimit,
} from "@/lib/rate-limit";

type AuthedContext = Context & { session: { user: { id: string } } };
type SessionTimeRange = "week" | "month" | "quarter";

const MESSAGE_EVENT_TYPES = ["message_sent", "shared_message_sent"];
const DAY_MS = 24 * 60 * 60 * 1000;

function analyticsSessionId() {
  return sql<string>`COALESCE(${analytics.sessionId}, ${analytics.eventData}->>'sessionId')`;
}

function getRangeStart(timeRange: SessionTimeRange): Date {
  const now = new Date();
  switch (timeRange) {
    case "week":
      return new Date(now.getTime() - 7 * DAY_MS);
    case "quarter":
      return new Date(now.getTime() - 90 * DAY_MS);
    case "month":
      return new Date(now.getTime() - 30 * DAY_MS);
  }
}

function dateKey(date: Date): string {
  return date.toISOString().split("T")[0]!;
}

function startOfUtcDay(date: Date): Date {
  const next = new Date(date);
  next.setUTCHours(0, 0, 0, 0);
  return next;
}

function startOfUtcWeek(date: Date): Date {
  const next = startOfUtcDay(date);
  const day = (next.getUTCDay() + 6) % 7;
  next.setUTCDate(next.getUTCDate() - day);
  return next;
}

function roundToOne(value: number): number {
  return Math.round(value * 10) / 10;
}

async function assertOwnedChatbot(
  ctx: AuthedContext,
  chatbotId: string,
): Promise<typeof chatbots.$inferSelect> {
  const [chatbot] = await ctx.db
    .select()
    .from(chatbots)
    .where(
      and(eq(chatbots.id, chatbotId), eq(chatbots.userId, ctx.session.user.id)),
    )
    .limit(1);

  if (!chatbot) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Chatbot not found" });
  }

  return chatbot;
}

function buildMessageStatsSubquery(
  db: typeof import("@teachanything/db").db,
  chatbotId: string,
) {
  return db
    .select({
      conversationId: messages.conversationId,
      messageCount: sql<number>`count(*)::int`.as("message_count"),
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

export const analyticsRouter = router({
  /**
   * Get chatbot statistics
   */
  getChatbotStats: protectedProcedure
    .input(z.object({ chatbotId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertOwnedChatbot(ctx, input.chatbotId);

      // Get total conversations
      const [conversationCount] = await ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(conversations)
        .where(eq(conversations.chatbotId, input.chatbotId));

      const totalConversations = conversationCount?.count ?? 0;

      // Get total messages across all conversations for this chatbot
      const [messageCount] = await ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(messages)
        .innerJoin(conversations, eq(messages.conversationId, conversations.id))
        .where(eq(conversations.chatbotId, input.chatbotId));

      const totalMessages = messageCount?.count ?? 0;

      const [analyticsSummary] = await ctx.db
        .select({
          ragEventCount: sql<number>`COALESCE(SUM(CASE WHEN (${analytics.eventData}->>'ragUsed') IS NOT NULL THEN 1 ELSE 0 END), 0)::int`,
          avgResponseTime: sql<number>`COALESCE(ROUND(AVG((${analytics.eventData}->>'responseTime')::double precision)), 0)::int`,
          ragHits: sql<number>`COALESCE(SUM(CASE WHEN ${analytics.eventData}->>'ragUsed' = 'true' THEN 1 ELSE 0 END), 0)::int`,
        })
        .from(analytics)
        .where(
          and(
            eq(analytics.chatbotId, input.chatbotId),
            inArray(analytics.eventType, MESSAGE_EVENT_TYPES),
          ),
        );

      const ragEventCount = analyticsSummary?.ragEventCount ?? 0;
      const ragHits = analyticsSummary?.ragHits ?? 0;
      const ragUsagePercentage =
        ragEventCount > 0 ? Math.round((ragHits / ragEventCount) * 100) : 0;

      return {
        totalConversations,
        totalMessages,
        avgResponseTime: analyticsSummary?.avgResponseTime ?? 0,
        ragUsagePercentage,
      };
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
      await assertOwnedChatbot(ctx, input.chatbotId);

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

      // Get messages grouped by date, scoped to this chatbot via a join.
      // Single round-trip instead of fetching conversation ids first.
      const messagesData = await ctx.db
        .select({
          date: sql<string>`DATE(${messages.createdAt})`,
          count: sql<number>`count(*)::int`,
        })
        .from(messages)
        .innerJoin(conversations, eq(messages.conversationId, conversations.id))
        .where(
          and(
            eq(conversations.chatbotId, input.chatbotId),
            gte(messages.createdAt, startDate),
          ),
        )
        .groupBy(sql`DATE(${messages.createdAt})`)
        .orderBy(sql`DATE(${messages.createdAt})`);

      // Format for chart (Recharts expects { date, count })
      return messagesData.map((row) => ({
        date: row.date,
        count: row.count,
      }));
    }),

  getSessionMetrics: protectedProcedure
    .input(z.object({ chatbotId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertOwnedChatbot(ctx, input.chatbotId);

      const sessionId = analyticsSessionId();
      const sessionEvents = ctx.db
        .select({
          sessionId: sessionId.as("session_id"),
          messageCount: sql<number>`count(*)::int`.as("message_count"),
          firstEventAt: sql<Date>`MIN(${analytics.createdAt})`.as(
            "first_event_at",
          ),
          lastEventAt: sql<Date>`MAX(${analytics.createdAt})`.as(
            "last_event_at",
          ),
        })
        .from(analytics)
        .where(
          and(
            eq(analytics.chatbotId, input.chatbotId),
            inArray(analytics.eventType, MESSAGE_EVENT_TYPES),
            sql`${sessionId} IS NOT NULL`,
          ),
        )
        .groupBy(sessionId)
        .as("session_events");

      const [summary] = await ctx.db
        .select({
          totalUniqueSessions: sql<number>`count(*)::int`,
          avgMessagesPerSession: sql<number>`COALESCE(AVG(${sessionEvents.messageCount}), 0)::double precision`,
          avgSessionDurationSeconds: sql<number>`COALESCE(AVG(EXTRACT(EPOCH FROM (${sessionEvents.lastEventAt} - ${sessionEvents.firstEventAt}))), 0)::double precision`,
        })
        .from(sessionEvents);

      return {
        totalUniqueSessions: summary?.totalUniqueSessions ?? 0,
        avgMessagesPerSession: roundToOne(summary?.avgMessagesPerSession ?? 0),
        avgSessionDurationSeconds: Math.round(
          summary?.avgSessionDurationSeconds ?? 0,
        ),
      };
    }),

  getSessionsOverTime: protectedProcedure
    .input(
      z.object({
        chatbotId: z.string().uuid(),
        timeRange: z.enum(["week", "month", "quarter"]).default("month"),
        interval: z.enum(["day", "week"]).default("day"),
      }),
    )
    .query(async ({ ctx, input }) => {
      await assertOwnedChatbot(ctx, input.chatbotId);

      const startDate = getRangeStart(input.timeRange);
      const now = new Date();
      const sessionId = analyticsSessionId();
      const periodExpr =
        input.interval === "week"
          ? sql<string>`DATE(date_trunc('week', ${analytics.createdAt}))`
          : sql<string>`DATE(${analytics.createdAt})`;

      const sessionsData = await ctx.db
        .select({
          date: periodExpr,
          count: sql<number>`count(distinct ${sessionId})::int`,
        })
        .from(analytics)
        .where(
          and(
            eq(analytics.chatbotId, input.chatbotId),
            inArray(analytics.eventType, MESSAGE_EVENT_TYPES),
            gte(analytics.createdAt, startDate),
            sql`${sessionId} IS NOT NULL`,
          ),
        )
        .groupBy(periodExpr)
        .orderBy(periodExpr);

      const dataMap = new Map<string, number>(
        sessionsData.map((row) => [row.date, row.count]),
      );
      const stepDays = input.interval === "week" ? 7 : 1;
      const firstPeriod =
        input.interval === "week"
          ? startOfUtcWeek(startDate)
          : startOfUtcDay(startDate);
      const filledData: Array<{ date: string; count: number }> = [];

      for (
        let current = firstPeriod;
        current <= now;
        current = new Date(current.getTime() + stepDays * DAY_MS)
      ) {
        const key = dateKey(current);
        filledData.push({ date: key, count: dataMap.get(key) ?? 0 });
      }

      return filledData;
    }),

  getSessionLengthDistribution: protectedProcedure
    .input(z.object({ chatbotId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await assertOwnedChatbot(ctx, input.chatbotId);

      const sessionId = analyticsSessionId();
      const sessionEvents = ctx.db
        .select({
          sessionId: sessionId.as("session_id"),
          messageCount: sql<number>`count(*)::int`.as("message_count"),
        })
        .from(analytics)
        .where(
          and(
            eq(analytics.chatbotId, input.chatbotId),
            inArray(analytics.eventType, MESSAGE_EVENT_TYPES),
            sql`${sessionId} IS NOT NULL`,
          ),
        )
        .groupBy(sessionId)
        .as("session_events");

      const [distribution] = await ctx.db
        .select({
          one: sql<number>`count(*) FILTER (WHERE ${sessionEvents.messageCount} = 1)::int`,
          twoToFive: sql<number>`count(*) FILTER (WHERE ${sessionEvents.messageCount} BETWEEN 2 AND 5)::int`,
          sixToTen: sql<number>`count(*) FILTER (WHERE ${sessionEvents.messageCount} BETWEEN 6 AND 10)::int`,
          tenPlus: sql<number>`count(*) FILTER (WHERE ${sessionEvents.messageCount} > 10)::int`,
        })
        .from(sessionEvents);

      return [
        { bucket: "1 message", count: distribution?.one ?? 0 },
        { bucket: "2-5 messages", count: distribution?.twoToFive ?? 0 },
        { bucket: "6-10 messages", count: distribution?.sixToTen ?? 0 },
        { bucket: "10+ messages", count: distribution?.tenPlus ?? 0 },
      ];
    }),

  getCommonQuestions: protectedProcedure
    .input(
      z.object({
        chatbotId: z.string().uuid(),
        limit: z.number().int().min(1).max(50).default(10),
        offset: z.number().int().min(0).default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      await assertOwnedChatbot(ctx, input.chatbotId);

      const firstUserMessages = ctx.db
        .select({
          conversationId: messages.conversationId,
          question: sql<string>`trim(${messages.content})`.as("question"),
          normalizedQuestion: sql<string>`lower(trim(${messages.content}))`.as(
            "normalized_question",
          ),
          rowNumber:
            sql<number>`row_number() over (partition by ${messages.conversationId} order by ${messages.createdAt} asc)`.as(
              "row_number",
            ),
        })
        .from(messages)
        .innerJoin(conversations, eq(messages.conversationId, conversations.id))
        .where(
          and(
            eq(conversations.chatbotId, input.chatbotId),
            eq(messages.role, "user"),
          ),
        )
        .as("first_user_messages");

      const groupedQuestions = ctx.db
        .select({
          question: sql<string>`MIN(${firstUserMessages.question})`.as(
            "question",
          ),
          count: sql<number>`count(*)::int`.as("count"),
        })
        .from(firstUserMessages)
        .where(
          and(
            sql`${firstUserMessages.rowNumber} = 1`,
            sql`${firstUserMessages.normalizedQuestion} <> ''`,
          ),
        )
        .groupBy(firstUserMessages.normalizedQuestion)
        .as("grouped_questions");

      const [total] = await ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(groupedQuestions);

      const questions = await ctx.db
        .select()
        .from(groupedQuestions)
        .orderBy(desc(groupedQuestions.count), asc(groupedQuestions.question))
        .limit(input.limit)
        .offset(input.offset);

      return {
        questions: questions.map((q) => ({
          question: q.question,
          count: q.count,
        })),
        totalCount: total?.count ?? 0,
      };
    }),

  getLowConfidenceQueries: protectedProcedure
    .input(
      z.object({
        chatbotId: z.string().uuid(),
        limit: z.number().int().min(1).max(50).default(10),
        offset: z.number().int().min(0).default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      await assertOwnedChatbot(ctx, input.chatbotId);

      const sessionId = analyticsSessionId();
      const lowConfidenceWhere = and(
        eq(analytics.chatbotId, input.chatbotId),
        inArray(analytics.eventType, MESSAGE_EVENT_TYPES),
        sql`${analytics.eventData}->>'ragUsed' = 'false'`,
      );

      const [total] = await ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(analytics)
        .where(lowConfidenceWhere);

      const rows = await ctx.db
        .select({
          id: analytics.id,
          sessionId,
          createdAt: analytics.createdAt,
          responseTime: sql<
            number | null
          >`(${analytics.eventData}->>'responseTime')::int`,
          sourcesCount: sql<
            number | null
          >`(${analytics.eventData}->>'sourcesCount')::int`,
          question: sql<string | null>`${analytics.eventData}->>'question'`,
        })
        .from(analytics)
        .where(lowConfidenceWhere)
        .orderBy(desc(analytics.createdAt), desc(analytics.id))
        .limit(input.limit)
        .offset(input.offset);

      return {
        queries: rows.map((row) => ({
          id: row.id,
          sessionId: row.sessionId,
          createdAt: row.createdAt,
          responseTime: row.responseTime,
          sourcesCount: row.sourcesCount,
          question: formatPreview(row.question) ?? "Question unavailable",
        })),
        totalCount: total?.count ?? 0,
      };
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
          count: sql<number>`count(*)::int`,
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
        messagesData.map((row) => [row.date, row.count]),
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
          count: dataMap.get(dateStr) ?? 0,
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

      return {
        messages: conversationMessages,
        conversation: row.conversation,
        totalCount: totalResult?.count ?? 0,
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
    }),

  /**
   * Delete one or more conversations (and their messages, via cascade) for a
   * chatbot the caller owns. Used by the Student Chats tab to clear retry junk.
   */
  deleteConversations: protectedProcedure
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
    }),

  /**
   * Export student chat records for a chatbot the caller owns. Returns the
   * full transcripts (user + assistant turns, timestamps, RAG sources) for the
   * given conversations, or for ALL of the chatbot's conversations when no ids
   * are passed. Powers the "Export" action in the Student Chats tab; the client
   * turns this payload into the chosen HTML/CSV/text files.
   *
   * This pages through unindexed content, so it is rate-limited and capped at
   * EXPORT_MAX_CONVERSATIONS per request (with a `truncated` flag so the client
   * can warn the professor when a chatbot has more than one bundle's worth).
   */
  exportConversations: protectedProcedure
    .input(
      z.object({
        chatbotId: z.string().uuid(),
        // Omitted or empty => export every conversation for the chatbot.
        conversationIds: z.array(z.string().uuid()).max(1000).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const chatbot = await assertOwnedChatbot(ctx, input.chatbotId);

      const { success } = await checkRateLimit(
        downloadRateLimit,
        ctx.session.user.id,
        { path: "analytics.exportConversations" },
      );
      if (!success) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Too many exports. Please wait a moment and try again.",
        });
      }

      const EXPORT_MAX_CONVERSATIONS = 1000;
      const selecting =
        input.conversationIds !== undefined && input.conversationIds.length > 0;

      // Resolve which conversations to export, always scoped to this chatbot so
      // a caller can't reach another chatbot's records by id. Fetch one extra
      // row to detect (and flag) truncation.
      const conversationRows = await ctx.db
        .select({
          id: conversations.id,
          sessionId: conversations.sessionId,
          createdAt: conversations.createdAt,
        })
        .from(conversations)
        .where(
          and(
            eq(conversations.chatbotId, input.chatbotId),
            selecting
              ? inArray(conversations.id, input.conversationIds!)
              : undefined,
          ),
        )
        .orderBy(asc(conversations.createdAt), asc(conversations.id))
        .limit(EXPORT_MAX_CONVERSATIONS + 1);

      const truncated = conversationRows.length > EXPORT_MAX_CONVERSATIONS;
      const selectedConversations = truncated
        ? conversationRows.slice(0, EXPORT_MAX_CONVERSATIONS)
        : conversationRows;

      const exportedAt = new Date().toISOString();

      if (selectedConversations.length === 0) {
        return {
          chatbotName: chatbot.name,
          exportedAt,
          truncated: false,
          maxConversations: EXPORT_MAX_CONVERSATIONS,
          conversations: [],
        };
      }

      const conversationIds = selectedConversations.map((c) => c.id);

      // Pull all visible turns for the selected conversations in one query,
      // globally ordered so each conversation's turns land in chronological
      // order when grouped below. System/internal messages are excluded to
      // mirror what the professor sees in the conversation viewer.
      const messageRows = await ctx.db
        .select({
          conversationId: messages.conversationId,
          role: messages.role,
          content: messages.content,
          metadata: messages.metadata,
          createdAt: messages.createdAt,
        })
        .from(messages)
        .where(
          and(
            inArray(messages.conversationId, conversationIds),
            inArray(messages.role, ["user", "assistant"]),
          ),
        )
        .orderBy(asc(messages.createdAt), asc(messages.id));

      const messagesByConversation = new Map<
        string,
        Array<{
          role: "user" | "assistant";
          content: string;
          createdAt: Date;
          sources: Array<{ fileName: string; similarity: number }>;
        }>
      >();

      for (const row of messageRows) {
        const list = messagesByConversation.get(row.conversationId) ?? [];
        list.push({
          role: row.role as "user" | "assistant",
          content: row.content,
          createdAt: row.createdAt,
          sources: (row.metadata?.sources ?? []).map((s) => ({
            fileName: s.fileName,
            similarity: s.similarity,
          })),
        });
        messagesByConversation.set(row.conversationId, list);
      }

      return {
        chatbotName: chatbot.name,
        exportedAt,
        truncated,
        maxConversations: EXPORT_MAX_CONVERSATIONS,
        conversations: selectedConversations.map((c) => ({
          id: c.id,
          sessionId: c.sessionId,
          createdAt: c.createdAt,
          messages: messagesByConversation.get(c.id) ?? [],
        })),
      };
    }),
});
