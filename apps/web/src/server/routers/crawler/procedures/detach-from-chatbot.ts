import { protectedProcedure } from "@/server/trpc";
import { z } from "zod";
import { eq, and, inArray, isNotNull } from "drizzle-orm";
import {
  crawledPages,
  chatbotFileAssociations,
  chatbotCrawlSourceAssociations,
} from "@teachanything/db/schema";
import { assertOwnedCrawlSource, assertOwnedChatbot } from "../helpers";
import { logInfo } from "@/lib/logger";

export const detachFromChatbotProcedure = protectedProcedure
  .input(
    z.object({
      crawlSourceId: z.string().uuid(),
      chatbotId: z.string().uuid(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    await assertOwnedCrawlSource(ctx, input.crawlSourceId);
    await assertOwnedChatbot(ctx, input.chatbotId);

    await ctx.db.transaction(async (tx) => {
      await tx
        .delete(chatbotCrawlSourceAssociations)
        .where(
          and(
            eq(
              chatbotCrawlSourceAssociations.crawlSourceId,
              input.crawlSourceId,
            ),
            eq(chatbotCrawlSourceAssociations.chatbotId, input.chatbotId),
          ),
        );

      const pages = await tx
        .select({ userFileId: crawledPages.userFileId })
        .from(crawledPages)
        .where(
          and(
            eq(crawledPages.crawlSourceId, input.crawlSourceId),
            isNotNull(crawledPages.userFileId),
          ),
        );

      const fileIds = pages
        .map((p) => p.userFileId)
        .filter((id): id is string => id !== null);

      // Remove ONLY this chatbot's associations to the source's crawled
      // files. The userFiles/chunks/pages are intentionally left intact so
      // the source can be re-attached later without re-crawling or
      // re-embedding. (Crawled files are deleted only when the source itself
      // is removed.)
      if (fileIds.length > 0) {
        await tx
          .delete(chatbotFileAssociations)
          .where(
            and(
              eq(chatbotFileAssociations.chatbotId, input.chatbotId),
              inArray(chatbotFileAssociations.fileId, fileIds),
            ),
          );
      }
    });

    logInfo("Web source detached from chatbot", {
      crawlSourceId: input.crawlSourceId,
      chatbotId: input.chatbotId,
    });

    return { success: true };
  });
