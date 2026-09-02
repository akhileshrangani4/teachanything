import { protectedProcedure } from "@/server/trpc";
import { TRPCError } from "@trpc/server";
import { logInfo, logError } from "@/lib/logger";
import { timeOutStuckCrawl } from "@/server/crawl-stale";
import { crawlSourceIdInput } from "../validation";
import { assertOwnedCrawlSource } from "../helpers";

export const cancelCrawlSourceProcedure = protectedProcedure
  .input(crawlSourceIdInput)
  .mutation(async ({ ctx, input }) => {
    const source = await assertOwnedCrawlSource(ctx, input.crawlSourceId);

    if (
      source.status !== "pending" &&
      source.status !== "discovering" &&
      source.status !== "crawling"
    ) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "This crawl is not running.",
      });
    }

    try {
      // Already-queued page jobs can still fire after this; processCrawlPage
      // bails once the source is no longer in a crawling state, so they drain
      // without reviving the source.
      await timeOutStuckCrawl({
        db: ctx.db,
        crawlSourceId: source.id,
        pageError: "Crawl stopped before this page was processed.",
        sourceError: "Crawl stopped.",
      });

      logInfo("Crawl source cancelled", { crawlSourceId: source.id });

      return { success: true };
    } catch (error) {
      logError(error, "Failed to cancel crawl source", {
        crawlSourceId: input.crawlSourceId,
      });
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to stop the crawl",
      });
    }
  });
