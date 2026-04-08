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

        if (fileIds.length > 0) {
          await tx
            .delete(chatbotFileAssociations)
            .where(
              and(
                eq(chatbotFileAssociations.chatbotId, source.chatbotId),
                inArray(chatbotFileAssociations.fileId, fileIds),
              ),
            );

          const remainingAssociations = await tx
            .select({ fileId: chatbotFileAssociations.fileId })
            .from(chatbotFileAssociations)
            .where(inArray(chatbotFileAssociations.fileId, fileIds));

          const remainingFileIds = new Set(
            remainingAssociations.map((a) => a.fileId),
          );
          const orphanedFileIds = fileIds.filter(
            (id) => !remainingFileIds.has(id),
          );

          if (orphanedFileIds.length > 0) {
            await tx
              .delete(userFiles)
              .where(inArray(userFiles.id, orphanedFileIds));
          }
        }

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
