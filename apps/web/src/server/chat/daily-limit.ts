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
  "id" | "userId" | "dailyMessageLimit"
>;

/**
 * The daily limits that apply to `chatbot`: its own and its owner's, each an
 * admin override when one is set, else the platform default.
 */
export async function resolveDailyLimits(
  database: typeof DbType,
  chatbot: LimitedChatbot,
): Promise<{ chatbot: number; owner: number }> {
  const [owner] = await database
    .select({ dailyMessageLimit: user.dailyMessageLimit })
    .from(user)
    .where(eq(user.id, chatbot.userId))
    .limit(1);
  return {
    chatbot: chatbot.dailyMessageLimit ?? CHATBOT_DAILY_MESSAGE_LIMIT,
    owner: owner?.dailyMessageLimit ?? OWNER_DAILY_MESSAGE_LIMIT,
  };
}

/**
 * Count one student message against `chatbot`'s daily limits, or throw
 * `ChatRequestError("daily_limit_reached", 429)` when either is used up.
 */
export async function enforceDailyLimit(
  database: typeof DbType,
  chatbot: LimitedChatbot,
): Promise<void> {
  const limits = await resolveDailyLimits(database, chatbot);
  const isWithinLimits = await consumeDailyMessage(
    { id: chatbot.id, ownerId: chatbot.userId },
    limits,
  );
  if (!isWithinLimits) {
    throw new ChatRequestError("daily_limit_reached", 429);
  }
}
