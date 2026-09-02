import { protectedProcedure } from "@/server/trpc";
import { z } from "zod";
import { analytics } from "@teachanything/db/schema";
import { eq, and, sql, gte, inArray } from "drizzle-orm";
import { assertOwnedChatbot } from "@/server/queries/chatbot";
import {
  MESSAGE_EVENT_TYPES,
  DAY_MS,
  analyticsSessionId,
  getRangeStart,
  dateKey,
  startOfUtcDay,
  startOfUtcWeek,
  roundToOne,
} from "../helpers";

export const getSessionMetricsProcedure = protectedProcedure
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
        lastEventAt: sql<Date>`MAX(${analytics.createdAt})`.as("last_event_at"),
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
  });

export const getSessionsOverTimeProcedure = protectedProcedure
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
  });

export const getSessionLengthDistributionProcedure = protectedProcedure
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
  });
