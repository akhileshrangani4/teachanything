import { adminProcedure } from "@/server/trpc";
import { z } from "zod";
import { conversations } from "@teachanything/db/schema";

/**
 * Get all conversations (admin view)
 */
export const getAllConversationsProcedure = adminProcedure
  .input(
    z.object({
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    }),
  )
  .query(async ({ ctx, input }) => {
    const allConversations = await ctx.db
      .select()
      .from(conversations)
      .orderBy(conversations.createdAt)
      .limit(input.limit)
      .offset(input.offset);

    return allConversations;
  });
