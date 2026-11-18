import { z } from "zod";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { chatbots, user } from "@teachanything/db/schema";
import { adminProcedure } from "@/server/trpc";
import { getOwnerUsage, NO_USAGE } from "@/server/queries/message-usage";
import { selectAdminChatbots, withChatbotUsage } from "../chatbot-rows";

/** One chatbot as the admin chatbot list shows it, for the details panel. */
export const getChatbotProcedure = adminProcedure
  .input(z.object({ chatbotId: z.string().uuid() }))
  .query(async ({ ctx, input }) => {
    const rows = await selectAdminChatbots(ctx.db)
      .where(eq(chatbots.id, input.chatbotId))
      .groupBy(chatbots.id, user.id);
    const [chatbot] = await withChatbotUsage(ctx.db, rows);
    if (!chatbot) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Chatbot not found" });
    }
    return chatbot;
  });

/** One user as the admin user list shows it, for the usage panel. */
export const getUserProcedure = adminProcedure
  .input(z.object({ userId: z.string().min(1) }))
  .query(async ({ ctx, input }) => {
    const [row] = await ctx.db
      .select()
      .from(user)
      .where(eq(user.id, input.userId))
      .limit(1);
    if (!row) {
      throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
    }
    const usage = await getOwnerUsage(ctx.db, [row.id]);
    return { ...row, usage: usage.get(row.id) ?? NO_USAGE };
  });
