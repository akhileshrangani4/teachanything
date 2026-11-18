import { z } from "zod";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { chatbots, user } from "@teachanything/db/schema";
import { adminProcedure } from "@/server/trpc";
import { MAX_DAILY_MESSAGE_LIMIT } from "@/lib/constants/rate-limits";

/**
 * A daily message limit override: 0 pauses, null returns to the platform
 * default.
 */
const dailyLimitSchema = z
  .number()
  .int()
  .min(0)
  .max(MAX_DAILY_MESSAGE_LIMIT)
  .nullable();

/** Set or clear one chatbot's daily message limit. */
export const setChatbotDailyLimitProcedure = adminProcedure
  .input(z.object({ chatbotId: z.string().uuid(), limit: dailyLimitSchema }))
  .mutation(async ({ ctx, input }) => {
    const updated = await ctx.db
      .update(chatbots)
      .set({ dailyMessageLimit: input.limit, updatedAt: new Date() })
      .where(eq(chatbots.id, input.chatbotId))
      .returning({ id: chatbots.id });
    if (updated.length === 0) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Chatbot not found" });
    }
    return { success: true };
  });

/** Set or clear one professor's daily message limit across their chatbots. */
export const setUserDailyLimitProcedure = adminProcedure
  .input(z.object({ userId: z.string().min(1), limit: dailyLimitSchema }))
  .mutation(async ({ ctx, input }) => {
    const updated = await ctx.db
      .update(user)
      .set({ dailyMessageLimit: input.limit, updatedAt: new Date() })
      .where(eq(user.id, input.userId))
      .returning({ id: user.id });
    if (updated.length === 0) {
      throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
    }
    return { success: true };
  });
