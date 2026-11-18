import { eq } from "drizzle-orm";
import { chatbots, user } from "@teachanything/db/schema";
import type { db as DbType } from "@teachanything/db";
import { consumeDailyMessage } from "@/server/rate-limit";
import {
  CHATBOT_DAILY_MESSAGE_LIMIT,
  OWNER_DAILY_MESSAGE_LIMIT,
} from "@/lib/constants/rate-limits";
import { ChatRequestError } from "./request";

type LimitedChatbot = Pick<
  typeof chatbots.$inferSelect,
  "id" | "userId" | "dailyMessageLimit" | "paused"
>;

type OwnerSettings = Pick<
  typeof user.$inferSelect,
  "dailyMessageLimit" | "chatbotsPaused"
>;

/** The admin-set limit and pause switch on `chatbot`'s owner. */
async function readOwnerSettings(
  database: typeof DbType,
  chatbot: LimitedChatbot,
): Promise<OwnerSettings | undefined> {
  const [owner] = await database
    .select({
      dailyMessageLimit: user.dailyMessageLimit,
      chatbotsPaused: user.chatbotsPaused,
    })
    .from(user)
    .where(eq(user.id, chatbot.userId))
    .limit(1);
  return owner;
}

/**
 * The daily limits that apply to `chatbot`: its own and its owner's, each an
 * admin override when one is set, else the platform default.
 */
export function dailyLimitsFor(
  chatbot: LimitedChatbot,
  owner: OwnerSettings | undefined,
): { chatbot: number; owner: number } {
  return {
    chatbot: chatbot.dailyMessageLimit ?? CHATBOT_DAILY_MESSAGE_LIMIT,
    owner: owner?.dailyMessageLimit ?? OWNER_DAILY_MESSAGE_LIMIT,
  };
}

/**
 * Admit one student message to `chatbot`, or throw:
 * - `ChatRequestError("chatbot_paused", 403)` when an admin has paused the
 *   chatbot or all of its owner's chatbots;
 * - `ChatRequestError("daily_limit_reached", 429)` when the chatbot's or the
 *   owner's daily limit is used up. Otherwise the message is counted.
 */
export async function enforceDailyLimit(
  database: typeof DbType,
  chatbot: LimitedChatbot,
): Promise<void> {
  const owner = await readOwnerSettings(database, chatbot);
  if (chatbot.paused || owner?.chatbotsPaused) {
    throw new ChatRequestError("chatbot_paused", 403);
  }
  const isWithinLimits = await consumeDailyMessage(
    { id: chatbot.id, ownerId: chatbot.userId },
    dailyLimitsFor(chatbot, owner),
  );
  if (!isWithinLimits) {
    throw new ChatRequestError("daily_limit_reached", 429);
  }
}
