import { protectedProcedure } from "@/server/trpc";
import { eq, and, isNotNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { crawlSources, crawledPages } from "@teachanything/db/schema";
import { logInfo, logError } from "@/lib/logger";
import { crawlSourceIdInput } from "../validation";
import { assertOwnedCrawlSource, deleteCrawlFileIds } from "../helpers";

export const removeCrawlSourceProcedure = protectedProcedure
  .input(crawlSourceIdInput)
  .mutation(async ({ ctx, input }) => {
    const source = await assertOwnedCrawlSource(ctx, input.crawlSourceId);

    // Block deletion while a crawl is in flight so workers don't
    // race us with inserts against rows we're about to drop.
    if (
      source.status === "pending" ||
      source.status === "discovering" ||
      source.status === "crawling"
    ) {
      throw new TRPCError({
        code: "CONFLICT",
        message:
          "Cannot remove this source while a crawl is in progress. Wait for the crawl to finish.",
      });
    }

    try {
      await ctx.db.transaction(async (tx) => {
        const pagesWithFiles = await tx
          .select({ userFileId: crawledPages.userFileId })
          .from(crawledPages)
          .where(
            and(
              eq(crawledPages.crawlSourceId, input.crawlSourceId),
              isNotNull(crawledPages.userFileId),
            ),
          );

        const fileIds = [
          ...new Set(
            pagesWithFiles
              .map((p) => p.userFileId)
              .filter((id): id is string => id !== null),
          ),
        ];

        await deleteCrawlFileIds(tx, source.chatbotId, fileIds);

        await tx
          .delete(crawlSources)
          .where(eq(crawlSources.id, input.crawlSourceId));
      });

      logInfo("Crawl source removed", {
        crawlSourceId: input.crawlSourceId,
        chatbotId: source.chatbotId,
      });

      return { success: true };
    } catch (error) {
      logError(error, "Failed to remove crawl source", {
        crawlSourceId: input.crawlSourceId,
      });
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to remove crawl source",
      });
    }
  });
