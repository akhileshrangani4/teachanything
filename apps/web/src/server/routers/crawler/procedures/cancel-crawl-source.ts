import { protectedProcedure } from "@/server/trpc";
import { logInfo, logError } from "@/lib/logger";
import { timeOutStuckCrawl } from "@/server/crawl-stale";
import { crawlSourceIdInput } from "../validation";
import { assertOwnedCrawlSource } from "../helpers";
import { appError } from "@/server/app-error";

export const cancelCrawlSourceProcedure = protectedProcedure
  .input(crawlSourceIdInput)
  .mutation(async ({ ctx, input }) => {
    const source = await assertOwnedCrawlSource(ctx, input.crawlSourceId);

    if (
      source.status !== "pending" &&
      source.status !== "discovering" &&
      source.status !== "crawling"
    ) {
      throw appError("BAD_REQUEST", "errors.crawler.crawlNotRunning");
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
      throw appError("INTERNAL_SERVER_ERROR", "errors.crawler.stopFailed");
    }
  });
