import { protectedProcedure } from "@/server/trpc";
import { eq, inArray, sql, desc } from "drizzle-orm";
import {
  chatbots,
  crawlSources,
  crawledPages,
  chatbotCrawlSourceAssociations,
} from "@teachanything/db/schema";
import { allCrawlSourcesInput } from "../validation";

export const getAllCrawlSourcesProcedure = protectedProcedure
  .input(allCrawlSourcesInput)
  .query(async ({ ctx, input }) => {
    const [totalCountResult] = await ctx.db
      .select({ count: sql<number>`count(*)` })
      .from(crawlSources)
      .where(eq(crawlSources.userId, ctx.session.user.id));
    const totalCount = Number(totalCountResult?.count ?? 0);

    const sources = await ctx.db
      .select({
        id: crawlSources.id,
        rootUrl: crawlSources.rootUrl,
        status: crawlSources.status,
        enabled: crawlSources.enabled,
        lastCrawledAt: crawlSources.lastCrawledAt,
        metadata: crawlSources.metadata,
        createdAt: crawlSources.createdAt,
      })
      .from(crawlSources)
      .where(eq(crawlSources.userId, ctx.session.user.id))
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

    // Attached chatbots per source (array; may be empty = "Not attached").
    const attachments = await ctx.db
      .select({
        crawlSourceId: chatbotCrawlSourceAssociations.crawlSourceId,
        chatbotId: chatbots.id,
        chatbotName: chatbots.name,
      })
      .from(chatbotCrawlSourceAssociations)
      .innerJoin(
        chatbots,
        eq(chatbots.id, chatbotCrawlSourceAssociations.chatbotId),
      )
      .where(inArray(chatbotCrawlSourceAssociations.crawlSourceId, sourceIds));

    const attachMap = new Map<string, { id: string; name: string }[]>();
    for (const row of attachments) {
      const list = attachMap.get(row.crawlSourceId) ?? [];
      list.push({ id: row.chatbotId, name: row.chatbotName });
      attachMap.set(row.crawlSourceId, list);
    }

    return {
      sources: sources.map((source) => ({
        ...source,
        pageCount: countMap.get(source.id) ?? 0,
        chatbots: attachMap.get(source.id) ?? [],
      })),
      totalCount,
    };
  });
