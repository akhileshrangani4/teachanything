import { protectedProcedure } from "@/server/trpc";
import { eq, and, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { chatbots, crawlSources, crawledPages } from "@teachanything/db/schema";
import { crawledPagesInput } from "../validation";

export const getCrawledPagesProcedure = protectedProcedure
  .input(crawledPagesInput)
  .query(async ({ ctx, input }) => {
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

    const [countResult] = await ctx.db
      .select({ count: sql<number>`count(*)` })
      .from(crawledPages)
      .where(eq(crawledPages.crawlSourceId, input.crawlSourceId));

    const totalCount = Number(countResult?.count ?? 0);

    const pages = await ctx.db
      .select()
      .from(crawledPages)
      .where(eq(crawledPages.crawlSourceId, input.crawlSourceId))
      .orderBy(crawledPages.createdAt, crawledPages.id)
      .limit(input.limit)
      .offset(input.offset);

    return { pages, totalCount };
  });
