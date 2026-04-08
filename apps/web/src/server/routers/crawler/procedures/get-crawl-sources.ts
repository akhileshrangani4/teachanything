import { protectedProcedure } from "@/server/trpc";
import { z } from "zod";
import { eq, and, sql, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { chatbots, crawlSources, crawledPages } from "@teachanything/db/schema";

export const getCrawlSourcesProcedure = protectedProcedure
  .input(z.object({ chatbotId: z.string().uuid() }))
  .query(async ({ ctx, input }) => {
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
      .select()
      .from(crawlSources)
      .where(eq(crawlSources.chatbotId, input.chatbotId));

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
      { pending: number; processing: number; completed: number; failed: number }
    >();

    for (const row of statusCounts) {
      if (!countMap.has(row.crawlSourceId)) {
        countMap.set(row.crawlSourceId, {
          pending: 0,
          processing: 0,
          completed: 0,
          failed: 0,
        });
      }
      const counts = countMap.get(row.crawlSourceId)!;
      const status = row.status as keyof typeof counts;
      if (status in counts) {
        counts[status] = Number(row.count);
      }
    }

    return sources.map((source) => ({
      ...source,
      pageCounts: countMap.get(source.id) ?? {
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
      },
    }));
  });
