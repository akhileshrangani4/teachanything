import { protectedProcedure } from "@/server/trpc";
import { eq, and, isNotNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { crawlSources, crawledPages } from "@teachanything/db/schema";
import { logInfo, logError } from "@/lib/logger";
import { crawlSourceIdInput } from "../validation";
import { assertOwnedCrawlSource, deleteAllCrawlFileIds } from "../helpers";

export const removeCrawlSourceProcedure = protectedProcedure
  .input(crawlSourceIdInput)
  .mutation(async ({ ctx, input }) => {
    const source = await assertOwnedCrawlSource(ctx, input.crawlSourceId);

    // Deletion is allowed even mid-crawl: blocking it left users stranded when
    // a worker died without writing a terminal status. In-flight workers
    // tolerate the rows disappearing -- processCrawlPage bails when its page or
    // source is gone, so nothing is written against dropped rows.
    try {
      await ctx.db.transaction(async (tx) => {
        // Take the source exclusively before reading its pages. Page workers
        // hold it in share mode for the length of their transaction, so this
        // waits for any in-flight page to commit its userFileId -- otherwise
        // the snapshot below misses that file and leaves it orphaned.
        await tx
          .select({ id: crawlSources.id })
          .from(crawlSources)
          .where(eq(crawlSources.id, input.crawlSourceId))
          .for("update");

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

        await deleteAllCrawlFileIds(tx, fileIds);

        await tx
          .delete(crawlSources)
          .where(eq(crawlSources.id, input.crawlSourceId));
      });

      logInfo("Crawl source removed", {
        crawlSourceId: source.id,
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
