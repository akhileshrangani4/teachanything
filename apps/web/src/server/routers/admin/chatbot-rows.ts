import { eq, sql } from "drizzle-orm";
import type { db as DbType } from "@teachanything/db";
import {
  chatbotFileAssociations,
  chatbots,
  user,
} from "@teachanything/db/schema";
import {
  getChatbotUsage,
  getOwnerUsage,
  NO_USAGE,
} from "@/server/queries/message-usage";

/**
 * The admin view of a chatbot row: the chatbot, its owner's limit and pause
 * state, and its file count. Callers add filters, sorting and paging.
 */
export function selectAdminChatbots(database: typeof DbType) {
  return database
    .select({
      id: chatbots.id,
      name: chatbots.name,
      description: chatbots.description,
      model: chatbots.model,
      createdAt: chatbots.createdAt,
      updatedAt: chatbots.updatedAt,
      userId: chatbots.userId,
      featured: chatbots.featured,
      sharingEnabled: chatbots.sharingEnabled,
      customAuthorName: chatbots.customAuthorName,
      dailyMessageLimit: chatbots.dailyMessageLimit,
      paused: chatbots.paused,
      ownerChatbotsPaused: user.chatbotsPaused,
      ownerDailyMessageLimit: user.dailyMessageLimit,
      userName: user.name,
      userEmail: user.email,
      userRole: user.role,
      fileCount: sql<number>`cast(count(distinct ${chatbotFileAssociations.id}) as int)`,
    })
    .from(chatbots)
    .leftJoin(user, eq(chatbots.userId, user.id))
    .leftJoin(
      chatbotFileAssociations,
      eq(chatbots.id, chatbotFileAssociations.chatbotId),
    );
}

type AdminChatbotRow = Awaited<
  ReturnType<ReturnType<typeof selectAdminChatbots>["groupBy"]>
>[number];

/** Attach each chatbot's usage and its owner's usage to admin rows. */
export async function withChatbotUsage(
  database: typeof DbType,
  rows: AdminChatbotRow[],
) {
  const [chatbotUsage, ownerUsage] = await Promise.all([
    getChatbotUsage(
      database,
      rows.map((row) => row.id),
    ),
    getOwnerUsage(database, [...new Set(rows.map((row) => row.userId))]),
  ]);
  return rows.map((row) => ({
    ...row,
    usage: chatbotUsage.get(row.id) ?? NO_USAGE,
    ownerUsage: ownerUsage.get(row.userId) ?? NO_USAGE,
  }));
}
