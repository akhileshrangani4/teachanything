import { protectedProcedure } from "@/server/trpc";
import { z } from "zod";
import { eq, and, sql, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  chatbots,
  crawlSources,
  crawledPages,
  chatbotCrawlSourceAssociations,
} from "@teachanything/db/schema";
import { sweepStaleCrawls } from "@/lib/crawl-stale";

export const getCrawlSourcesProcedure = protectedProcedure
  .input(z.object({ chatbotId: z.string().uuid() }))
  .query(async ({ ctx, input }) => {
    // Settle abandoned crawls before reading so a dead worker can't leave a
    // source spinning (and undeletable) indefinitely.
    await sweepStaleCrawls({ db: ctx.db, userId: ctx.session.user.id });

    const [chatbot] = await ctx.db
      .select()
      .from(chatbots)
      .where(
        and(
          eq(chatbots.id, input.chatbotId),
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

    const sources = await ctx.db
      .select({
        id: crawlSources.id,
        userId: crawlSources.userId,
        rootUrl: crawlSources.rootUrl,
        status: crawlSources.status,
        enabled: crawlSources.enabled,
        crawlDepth: crawlSources.crawlDepth,
        maxPages: crawlSources.maxPages,
        includePatterns: crawlSources.includePatterns,
        excludePatterns: crawlSources.excludePatterns,
        lastCrawledAt: crawlSources.lastCrawledAt,
        metadata: crawlSources.metadata,
        createdAt: crawlSources.createdAt,
        updatedAt: crawlSources.updatedAt,
      })
      .from(chatbotCrawlSourceAssociations)
      .innerJoin(
        crawlSources,
        eq(crawlSources.id, chatbotCrawlSourceAssociations.crawlSourceId),
      )
      .where(eq(chatbotCrawlSourceAssociations.chatbotId, input.chatbotId));

    if (sources.length === 0) return [];

    const sourceIds = sources.map((s) => s.id);

    const statusCounts = await ctx.db
      .select({
        crawlSourceId: crawledPages.crawlSourceId,
        status: crawledPages.status,
        count: sql<number>`count(*)`,
      })
      .from(crawledPages)
      .where(inArray(crawledPages.crawlSourceId, sourceIds))
      .groupBy(crawledPages.crawlSourceId, crawledPages.status);

    const countMap = new Map<
      string,
      {
        pending: number;
        processing: number;
        completed: number;
        failed: number;
        blocked: number;
        skipped: number;
      }
    >();

    for (const row of statusCounts) {
      if (!countMap.has(row.crawlSourceId)) {
        countMap.set(row.crawlSourceId, {
          pending: 0,
          processing: 0,
          completed: 0,
          failed: 0,
          blocked: 0,
          skipped: 0,
        });
      }
      const counts = countMap.get(row.crawlSourceId)!;
      if (row.status in counts) {
        counts[row.status as keyof typeof counts] = Number(row.count);
      }
    }

    return sources.map((source) => ({
      ...source,
      pageCounts: countMap.get(source.id) ?? {
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        blocked: 0,
        skipped: 0,
      },
    }));
  });
