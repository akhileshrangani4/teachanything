import { protectedProcedure } from "@/server/trpc";
import { z } from "zod";
import {
  chatbots,
  conversations,
  messages,
  analytics,
  user,
} from "@teachanything/db/schema";
import { eq, and, sql, gte, lte, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { assertOwnedChatbot } from "@/server/queries/chatbot";
import { MESSAGE_EVENT_TYPES } from "../helpers";

export const getChatbotStatsProcedure = protectedProcedure
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
  });

export const getMessageVolumeProcedure = protectedProcedure
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
  });

export const getTotalMessagesPerMonthProcedure = protectedProcedure
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

    // Existence check only — the per-message aggregation below joins
    // through to chatbots directly, so we never materialize id arrays
    // for every conversation the user owns.
    //
    // This probes CONVERSATIONS, not chatbots: a user who owns chatbots but
    // has never been chatted with must still get the empty-series response,
    // otherwise they receive 30 zero-filled rows plus `accountCreatedAt`,
    // which flips MessagesChart's back-pagination guard on. Costs one
    // indexed EXISTS, and LIMIT 1 stops at the first row.
    const [existingConversation] = await ctx.db
      .select({ id: conversations.id })
      .from(conversations)
      .innerJoin(chatbots, eq(conversations.chatbotId, chatbots.id))
      .where(eq(chatbots.userId, ctx.session.user.id))
      .limit(1);

    if (!existingConversation) {
      return {
        data: [],
        startDate: accountCreatedAt,
        endDate: accountCreatedAt,
      };
    }

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

    // Get messages grouped by day within the date range, joined through
    // to the user's chatbots so no id lists are materialized in Node.
    const messagesData = await ctx.db
      .select({
        date: sql<string>`DATE(${messages.createdAt})`,
        count: sql<number>`count(*)::int`,
      })
      .from(messages)
      .innerJoin(conversations, eq(messages.conversationId, conversations.id))
      .innerJoin(chatbots, eq(conversations.chatbotId, chatbots.id))
      .where(
        and(
          eq(chatbots.userId, ctx.session.user.id),
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
  });
