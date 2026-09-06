import { protectedProcedure } from "@/server/trpc";
import { eq } from "drizzle-orm";
import { crawlSources } from "@teachanything/db/schema";
import { renameCrawlSourceInput } from "../validation";
import { assertOwnedCrawlSource } from "../helpers";
import { mergeCrawlSourceMetadata } from "@/server/crawler-metadata-sql";

export const renameCrawlSourceProcedure = protectedProcedure
  .input(renameCrawlSourceInput)
  .mutation(async ({ ctx, input }) => {
    await assertOwnedCrawlSource(ctx, input.crawlSourceId);

    const [updated] = await ctx.db
      .update(crawlSources)
      .set({
        metadata: mergeCrawlSourceMetadata({ displayName: input.name.trim() }),
        updatedAt: new Date(),
      })
      .where(eq(crawlSources.id, input.crawlSourceId))
      .returning();

    return updated;
  });
