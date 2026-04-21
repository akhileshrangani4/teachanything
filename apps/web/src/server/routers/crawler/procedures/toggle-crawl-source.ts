import { protectedProcedure } from "@/server/trpc";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { chatbots, crawlSources } from "@teachanything/db/schema";
import { logInfo } from "@/lib/logger";

export const toggleCrawlSourceProcedure = protectedProcedure
  .input(
    z.object({
      crawlSourceId: z.string().uuid(),
      enabled: z.boolean(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const [source] = await ctx.db
      .select()
      .from(crawlSources)
      .where(eq(crawlSources.id, input.crawlSourceId))
      .limit(1);

    if (!source) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Crawl source not found",
      });
    }

    const [chatbot] = await ctx.db
      .select()
      .from(chatbots)
      .where(
        and(
          eq(chatbots.id, source.chatbotId),
          eq(chatbots.userId, ctx.session.user.id),
        ),
      )
      .limit(1);

    if (!chatbot) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Chatbot not found",
      });
    }

    const [updated] = await ctx.db
      .update(crawlSources)
      .set({ enabled: input.enabled, updatedAt: new Date() })
      .where(eq(crawlSources.id, input.crawlSourceId))
      .returning();

    logInfo("Crawl source toggled", {
      crawlSourceId: input.crawlSourceId,
      enabled: input.enabled,
    });

    return updated;
  });
