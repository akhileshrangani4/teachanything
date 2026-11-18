import { z } from "zod";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import type { db as DbType } from "@teachanything/db";
import { chatbots, user } from "@teachanything/db/schema";
import { adminProcedure } from "@/server/trpc";
import { MAX_DAILY_MESSAGE_LIMIT } from "@/lib/constants/rate-limits";
import { getChatbotUsage, NO_USAGE } from "../usage";

/** A daily message limit override; null returns to the platform default. */
const dailyLimitSchema = z
  .number()
  .int()
  .min(1)
  .max(MAX_DAILY_MESSAGE_LIMIT)
  .nullable();

const chatbotIdSchema = z.string().uuid();
const userIdSchema = z.string().min(1);

/** Apply `values` to one chatbot, or throw NOT_FOUND. */
async function updateChatbot(
  db: typeof DbType,
  chatbotId: string,
  values: Partial<typeof chatbots.$inferInsert>,
) {
  const updated = await db
    .update(chatbots)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(chatbots.id, chatbotId))
    .returning({ id: chatbots.id });
  if (updated.length === 0) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Chatbot not found" });
  }
  return { success: true };
}

/** Apply `values` to one user, or throw NOT_FOUND. */
async function updateUser(
  db: typeof DbType,
  userId: string,
  values: Partial<typeof user.$inferInsert>,
) {
  const updated = await db
    .update(user)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(user.id, userId))
    .returning({ id: user.id });
  if (updated.length === 0) {
    throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
  }
  return { success: true };
}

/** Set or clear one chatbot's daily message limit. */
export const setChatbotDailyLimitProcedure = adminProcedure
  .input(z.object({ chatbotId: chatbotIdSchema, limit: dailyLimitSchema }))
  .mutation(({ ctx, input }) =>
    updateChatbot(ctx.db, input.chatbotId, {
      dailyMessageLimit: input.limit,
    }),
  );

/** Set or clear one professor's daily message limit across their chatbots. */
export const setUserDailyLimitProcedure = adminProcedure
  .input(z.object({ userId: userIdSchema, limit: dailyLimitSchema }))
  .mutation(({ ctx, input }) =>
    updateUser(ctx.db, input.userId, { dailyMessageLimit: input.limit }),
  );

/** Turn one chatbot off for students, or back on. */
export const setChatbotPausedProcedure = adminProcedure
  .input(z.object({ chatbotId: chatbotIdSchema, paused: z.boolean() }))
  .mutation(({ ctx, input }) =>
    updateChatbot(ctx.db, input.chatbotId, { paused: input.paused }),
  );

/** Turn all of one professor's chatbots off for students, or back on. */
export const setUserChatbotsPausedProcedure = adminProcedure
  .input(z.object({ userId: userIdSchema, paused: z.boolean() }))
  .mutation(({ ctx, input }) =>
    updateUser(ctx.db, input.userId, { chatbotsPaused: input.paused }),
  );

/** One professor's chatbots with their limits, pause state and usage. */
export const getUserChatbotsProcedure = adminProcedure
  .input(z.object({ userId: userIdSchema }))
  .query(async ({ ctx, input }) => {
    const rows = await ctx.db
      .select({
        id: chatbots.id,
        name: chatbots.name,
        paused: chatbots.paused,
        sharingEnabled: chatbots.sharingEnabled,
        dailyMessageLimit: chatbots.dailyMessageLimit,
      })
      .from(chatbots)
      .where(eq(chatbots.userId, input.userId))
      .orderBy(chatbots.name);
    const usage = await getChatbotUsage(
      ctx.db,
      rows.map((r) => r.id),
    );
    return rows.map((row) => ({
      ...row,
      usage: usage.get(row.id) ?? NO_USAGE,
    }));
  });
