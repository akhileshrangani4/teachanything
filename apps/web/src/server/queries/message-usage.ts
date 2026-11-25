import { and, eq, gte, inArray, sql, type AnyColumn } from "drizzle-orm";
import type { db as DbType } from "@teachanything/db";
import { chatbots, conversations, messages } from "@teachanything/db/schema";

/** Student messages over three windows. "Today" is the US Eastern day. */
export type MessageUsage = {
  today: number;
  last7Days: number;
  last30Days: number;
};

export const NO_USAGE: MessageUsage = { today: 0, last7Days: 0, last30Days: 0 };

/**
 * Start of the current US Eastern day, as the UTC wall-clock timestamp the
 * `messages.created_at` column (timestamp without time zone, UTC) stores.
 * Matches the day boundary the daily limit counters use.
 */
const easternDayStart = sql`(date_trunc('day', now() at time zone 'America/New_York') at time zone 'America/New_York') at time zone 'UTC'`;

/** Aggregate columns shared by both usage queries. */
function usageColumns() {
  return {
    today: sql<number>`count(*) filter (where ${messages.createdAt} >= ${easternDayStart})::int`,
    last7Days: sql<number>`count(*) filter (where ${messages.createdAt} >= now() at time zone 'UTC' - interval '7 days')::int`,
    last30Days: sql<number>`count(*)::int`,
  };
}

/** Only student messages from the last 30 days; each query narrows further. */
function recentStudentMessages() {
  return and(
    eq(messages.role, "user"),
    gte(messages.createdAt, sql`now() at time zone 'UTC' - interval '30 days'`),
  );
}

function toUsageMap(
  rows: ({ id: string } & MessageUsage)[],
): Map<string, MessageUsage> {
  return new Map(rows.map(({ id, ...usage }) => [id, usage] as const));
}

/** Student message counts for each of `chatbotIds`. */
export async function getChatbotUsage(
  database: typeof DbType,
  chatbotIds: string[],
): Promise<Map<string, MessageUsage>> {
  if (chatbotIds.length === 0) return new Map();
  const rows = await database
    .select({ id: conversations.chatbotId, ...usageColumns() })
    .from(messages)
    .innerJoin(conversations, eq(conversations.id, messages.conversationId))
    .where(
      and(
        inArray(conversations.chatbotId, chatbotIds),
        recentStudentMessages(),
      ),
    )
    .groupBy(conversations.chatbotId);
  return toUsageMap(rows);
}

/** Student message counts across all chatbots of each of `ownerIds`. */
export async function getOwnerUsage(
  database: typeof DbType,
  ownerIds: string[],
): Promise<Map<string, MessageUsage>> {
  if (ownerIds.length === 0) return new Map();
  const rows = await database
    .select({ id: chatbots.userId, ...usageColumns() })
    .from(messages)
    .innerJoin(conversations, eq(conversations.id, messages.conversationId))
    .innerJoin(chatbots, eq(chatbots.id, conversations.chatbotId))
    .where(and(inArray(chatbots.userId, ownerIds), recentStudentMessages()))
    .groupBy(chatbots.userId);
  return toUsageMap(rows);
}

/** The windows the admin lists can sort by, matching `MessageUsage`. */
export type UsageWindow = keyof MessageUsage;

function windowStart(window: UsageWindow) {
  return window === "today"
    ? easternDayStart
    : window === "last7Days"
      ? sql`now() at time zone 'UTC' - interval '7 days'`
      : sql`now() at time zone 'UTC' - interval '30 days'`;
}

/**
 * The chatbot in `chatbotId`'s student message count over `window`, as a
 * correlated subquery the admin lists can sort by.
 */
export function chatbotUsageCountSql(
  chatbotId: AnyColumn,
  window: UsageWindow,
) {
  return sql<number>`(
    select count(*) from ${messages}
    join ${conversations} on ${conversations.id} = ${messages.conversationId}
    where ${conversations.chatbotId} = ${chatbotId}
      and ${messages.role} = 'user'
      and ${messages.createdAt} >= ${windowStart(window)}
  )`;
}

/**
 * The student message count over `window` across all chatbots of the user in
 * `ownerId`, as a correlated subquery the admin lists can sort by.
 */
export function ownerUsageCountSql(ownerId: AnyColumn, window: UsageWindow) {
  return sql<number>`(
    select count(*) from ${messages}
    join ${conversations} on ${conversations.id} = ${messages.conversationId}
    join ${chatbots} on ${chatbots.id} = ${conversations.chatbotId}
    where ${chatbots.userId} = ${ownerId}
      and ${messages.role} = 'user'
      and ${messages.createdAt} >= ${windowStart(window)}
  )`;
}

/** Sort keys for the usage columns, and the window each one counts. */
export const USAGE_SORT_WINDOWS = {
  usageToday: "today",
  usage7Days: "last7Days",
  usage30Days: "last30Days",
} as const satisfies Record<string, UsageWindow>;

export type UsageSortKey = keyof typeof USAGE_SORT_WINDOWS;
export const USAGE_SORT_KEYS = Object.keys(USAGE_SORT_WINDOWS) as [
  UsageSortKey,
  ...UsageSortKey[],
];
