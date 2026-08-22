import { eq, sql } from "drizzle-orm";
import { analytics, conversations, messages } from "@teachanything/db/schema";

export type SessionTimeRange = "week" | "month" | "quarter";

export const MESSAGE_EVENT_TYPES = ["message_sent", "shared_message_sent"];
export const DAY_MS = 24 * 60 * 60 * 1000;

export function analyticsSessionId() {
  return sql<string>`COALESCE(${analytics.sessionId}, ${analytics.eventData}->>'sessionId')`;
}

export function getRangeStart(timeRange: SessionTimeRange): Date {
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

export function dateKey(date: Date): string {
  return date.toISOString().split("T")[0]!;
}

export function startOfUtcDay(date: Date): Date {
  const next = new Date(date);
  next.setUTCHours(0, 0, 0, 0);
  return next;
}

export function startOfUtcWeek(date: Date): Date {
  const next = startOfUtcDay(date);
  const day = (next.getUTCDay() + 6) % 7;
  next.setUTCDate(next.getUTCDate() - day);
  return next;
}

export function roundToOne(value: number): number {
  return Math.round(value * 10) / 10;
}

export function buildMessageStatsSubquery(
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
