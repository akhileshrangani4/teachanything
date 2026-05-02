import { protectedProcedure } from "@/server/trpc";
import { eq, inArray, sql, desc } from "drizzle-orm";
import { chatbots, crawlSources, crawledPages } from "@teachanything/db/schema";
import { allCrawlSourcesInput } from "../validation";

export const getAllCrawlSourcesProcedure = protectedProcedure
  .input(allCrawlSourcesInput)
  .query(async ({ ctx, input }) => {
    const [totalCountResult] = await ctx.db
      .select({ count: sql<number>`count(*)` })
      .from(crawlSources)
      .innerJoin(chatbots, eq(chatbots.id, crawlSources.chatbotId))
      .where(eq(chatbots.userId, ctx.session.user.id));
    const totalCount = Number(totalCountResult?.count ?? 0);

    const sources = await ctx.db
      .select({
        id: crawlSources.id,
        chatbotId: crawlSources.chatbotId,
        chatbotName: chatbots.name,
        rootUrl: crawlSources.rootUrl,
        status: crawlSources.status,
        enabled: crawlSources.enabled,
        lastCrawledAt: crawlSources.lastCrawledAt,
        metadata: crawlSources.metadata,
        createdAt: crawlSources.createdAt,
      })
      .from(crawlSources)
      .innerJoin(chatbots, eq(chatbots.id, crawlSources.chatbotId))
      .where(eq(chatbots.userId, ctx.session.user.id))
      .orderBy(desc(crawlSources.createdAt), desc(crawlSources.id))
      .limit(input.limit)
      .offset(input.offset);

    if (sources.length === 0) return { sources: [], totalCount };

    const sourceIds = sources.map((source) => source.id);
    const pageCounts = await ctx.db
      .select({
        crawlSourceId: crawledPages.crawlSourceId,
        count: sql<number>`count(*)`,
      })
      .from(crawledPages)
      .where(inArray(crawledPages.crawlSourceId, sourceIds))
      .groupBy(crawledPages.crawlSourceId);

    const countMap = new Map(
      pageCounts.map((row) => [row.crawlSourceId, Number(row.count)]),
    );

    return {
      sources: sources.map((source) => ({
        ...source,
        pageCount: countMap.get(source.id) ?? 0,
      })),
      totalCount,
    };
  });
