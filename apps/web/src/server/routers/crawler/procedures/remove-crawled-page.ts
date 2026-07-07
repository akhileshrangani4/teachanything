import { protectedProcedure } from "@/server/trpc";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { crawledPages } from "@teachanything/db/schema";
import { logInfo, logError } from "@/lib/logger";
import { crawledPageIdInput } from "../validation";
import { assertOwnedCrawledPage, deleteAllCrawlFileIds } from "../helpers";

export const removeCrawledPageProcedure = protectedProcedure
  .input(crawledPageIdInput)
  .mutation(async ({ ctx, input }) => {
    const { source } = await assertOwnedCrawledPage(ctx, input.crawledPageId);

    // Block deletion while a crawl is actively writing to this source --
    // otherwise a worker may try to insert chunks against a just-deleted
    // userFile, triggering FK violations and stuck jobs.
    if (
      source.status === "discovering" ||
      source.status === "crawling" ||
      source.status === "pending"
    ) {
      throw new TRPCError({
        code: "CONFLICT",
        message:
          "Cannot remove this page while a crawl is in progress. Wait for the crawl to finish.",
      });
    }

    try {
      await ctx.db.transaction(async (tx) => {
        // Re-read the page inside the transaction to close the orphan window:
        // between the preflight check and this point, the crawl worker could
        // have set userFileId. FOR UPDATE locks the row so the worker can't
        // race us mid-transaction.
        const [fresh] = await tx
          .select()
          .from(crawledPages)
          .where(eq(crawledPages.id, input.crawledPageId))
          .for("update")
          .limit(1);

        if (!fresh) return; // already deleted concurrently

        if (fresh.userFileId) {
          // A crawled page owns its userFile 1:1, so deleting the page means
          // deleting that file everywhere: remove its associations across all
          // chatbots, then the userFile itself.
          await deleteAllCrawlFileIds(tx, [fresh.userFileId]);
        }

        await tx
          .delete(crawledPages)
          .where(eq(crawledPages.id, input.crawledPageId));
      });

      logInfo("Crawled page removed", {
        crawledPageId: input.crawledPageId,
        crawlSourceId: source.id,
      });

      return { success: true };
    } catch (error) {
      logError(error, "Failed to remove crawled page", {
        crawledPageId: input.crawledPageId,
      });
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to remove crawled page",
      });
    }
  });
