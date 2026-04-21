import { protectedProcedure } from "@/server/trpc";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  chatbots,
  crawlSources,
  crawledPages,
  userFiles,
  chatbotFileAssociations,
} from "@teachanything/db/schema";
import { logInfo, logError } from "@/lib/logger";
import { crawledPageIdInput } from "../validation";

export const removeCrawledPageProcedure = protectedProcedure
  .input(crawledPageIdInput)
  .mutation(async ({ ctx, input }) => {
    const [page] = await ctx.db
      .select()
      .from(crawledPages)
      .where(eq(crawledPages.id, input.crawledPageId))
      .limit(1);

    if (!page) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Crawled page not found",
      });
    }

    const [source] = await ctx.db
      .select()
      .from(crawlSources)
      .where(eq(crawlSources.id, page.crawlSourceId))
      .limit(1);

    if (!source) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Crawl source not found",
      });
    }

    const [chatbot] = await ctx.db
      .select()
      .from(chatbots)
      .where(
        and(
          eq(chatbots.id, source.chatbotId),
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

    try {
      await ctx.db.transaction(async (tx) => {
        if (page.userFileId) {
          // Deleting the userFile cascades to fileChunks and, via the
          // chatbotFileAssociations FK, to associations.
          await tx
            .delete(chatbotFileAssociations)
            .where(eq(chatbotFileAssociations.fileId, page.userFileId));
          await tx
            .delete(userFiles)
            .where(eq(userFiles.id, page.userFileId));
        }
        await tx
          .delete(crawledPages)
          .where(eq(crawledPages.id, input.crawledPageId));
      });

      logInfo("Crawled page removed", {
        crawledPageId: input.crawledPageId,
        crawlSourceId: page.crawlSourceId,
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
