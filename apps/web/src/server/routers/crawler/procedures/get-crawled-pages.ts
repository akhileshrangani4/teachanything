import { protectedProcedure } from "@/server/trpc";
import { eq, sql } from "drizzle-orm";
import { crawledPages } from "@teachanything/db/schema";
import { crawledPagesInput } from "../validation";
import { assertOwnedCrawlSource } from "../helpers";

export const getCrawledPagesProcedure = protectedProcedure
  .input(crawledPagesInput)
  .query(async ({ ctx, input }) => {
    await assertOwnedCrawlSource(ctx, input.crawlSourceId);

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
