import { eq } from "drizzle-orm";
import { chatbots, user } from "@teachanything/db/schema";
import { protectedProcedure } from "@/server/trpc";
import {
  CHATBOT_DAILY_MESSAGE_LIMIT,
  OWNER_DAILY_MESSAGE_LIMIT,
} from "@/lib/constants/rate-limits";
import { getChatbotUsage, getOwnerUsage } from "@/server/queries/message-usage";

/** Today's usage against a daily limit, and whether an admin paused it. */
export type DailyUsage = { today: number; limit: number; paused: boolean };

/**
 * The signed-in instructor's student messages today: their total across all
 * chatbots, and each chatbot's own, each against the limit that applies.
 * Today is the US Eastern day, the same one the limits reset on.
 */
export const getDailyUsageProcedure = protectedProcedure.query(
  async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const [[owner], ownChatbots] = await Promise.all([
      ctx.db
        .select({
          dailyMessageLimit: user.dailyMessageLimit,
          chatbotsPaused: user.chatbotsPaused,
        })
        .from(user)
        .where(eq(user.id, userId))
        .limit(1),
      ctx.db
        .select({
          id: chatbots.id,
          dailyMessageLimit: chatbots.dailyMessageLimit,
          paused: chatbots.paused,
        })
        .from(chatbots)
        .where(eq(chatbots.userId, userId)),
    ]);
    const [ownerUsage, chatbotUsage] = await Promise.all([
      getOwnerUsage(ctx.db, [userId]),
      getChatbotUsage(
        ctx.db,
        ownChatbots.map((chatbot) => chatbot.id),
      ),
    ]);

    const total: DailyUsage = {
      today: ownerUsage.get(userId)?.today ?? 0,
      limit: owner?.dailyMessageLimit ?? OWNER_DAILY_MESSAGE_LIMIT,
      paused: owner?.chatbotsPaused ?? false,
    };
    const byChatbot: Record<string, DailyUsage> = Object.fromEntries(
      ownChatbots.map((chatbot) => [
        chatbot.id,
        {
          today: chatbotUsage.get(chatbot.id)?.today ?? 0,
          limit: chatbot.dailyMessageLimit ?? CHATBOT_DAILY_MESSAGE_LIMIT,
          paused: chatbot.paused,
        },
      ]),
    );
    return { total, byChatbot };
  },
);
