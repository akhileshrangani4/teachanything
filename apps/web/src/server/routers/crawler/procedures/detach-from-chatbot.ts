import { protectedProcedure } from "@/server/trpc";
import { z } from "zod";
import { eq, and, isNotNull } from "drizzle-orm";
import {
  crawledPages,
  chatbotCrawlSourceAssociations,
} from "@teachanything/db/schema";
import {
  assertOwnedCrawlSource,
  assertOwnedChatbot,
  deleteCrawlFileIds,
} from "../helpers";
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

      await deleteCrawlFileIds(tx, input.chatbotId, fileIds);
    });

    logInfo("Web source detached from chatbot", {
      crawlSourceId: input.crawlSourceId,
      chatbotId: input.chatbotId,
    });

    return { success: true };
  });
