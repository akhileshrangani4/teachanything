import { protectedProcedure } from "@/server/trpc";
import { eq, and, inArray, isNotNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  chatbots,
  crawlSources,
  crawledPages,
  userFiles,
  chatbotFileAssociations,
} from "@teachanything/db/schema";
import { logInfo, logError } from "@/lib/logger";
import { crawlSourceIdInput } from "../validation";

export const removeCrawlSourceProcedure = protectedProcedure
  .input(crawlSourceIdInput)
  .mutation(async ({ ctx, input }) => {
    const [source] = await ctx.db
      .select()
      .from(crawlSources)
      .where(eq(crawlSources.id, input.crawlSourceId))
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
      const pagesWithFiles = await ctx.db
        .select({ userFileId: crawledPages.userFileId })
        .from(crawledPages)
        .where(
          and(
            eq(crawledPages.crawlSourceId, input.crawlSourceId),
            isNotNull(crawledPages.userFileId),
          ),
        );

      const fileIds = pagesWithFiles
        .map((p) => p.userFileId)
        .filter((id): id is string => id !== null);

      if (fileIds.length > 0) {
        await ctx.db
          .delete(chatbotFileAssociations)
          .where(inArray(chatbotFileAssociations.fileId, fileIds));

        await ctx.db.delete(userFiles).where(inArray(userFiles.id, fileIds));
      }

      await ctx.db
        .delete(crawlSources)
        .where(eq(crawlSources.id, input.crawlSourceId));

      logInfo("Crawl source removed", {
        crawlSourceId: input.crawlSourceId,
        chatbotId: source.chatbotId,
        deletedFileCount: fileIds.length,
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
