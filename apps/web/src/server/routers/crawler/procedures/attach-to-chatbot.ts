import { protectedProcedure } from "@/server/trpc";
import { z } from "zod";
import { eq, and, isNotNull } from "drizzle-orm";
import {
  crawledPages,
  chatbotFileAssociations,
  chatbotCrawlSourceAssociations,
} from "@teachanything/db/schema";
import { assertOwnedCrawlSource } from "../helpers";
import { assertOwnedChatbot } from "@/server/queries/chatbot";
import { logInfo } from "@/lib/logger";

export const attachToChatbotProcedure = protectedProcedure
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
        .insert(chatbotCrawlSourceAssociations)
        .values({
          chatbotId: input.chatbotId,
          crawlSourceId: input.crawlSourceId,
        })
        .onConflictDoNothing();

      // Backfill file associations for every already-crawled page of this
      // source so the chatbot's RAG context picks them up immediately.
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

      if (fileIds.length > 0) {
        await tx
          .insert(chatbotFileAssociations)
          .values(
            fileIds.map((fileId) => ({ chatbotId: input.chatbotId, fileId })),
          )
          .onConflictDoNothing();
      }
    });

    logInfo("Web source attached to chatbot", {
      crawlSourceId: input.crawlSourceId,
      chatbotId: input.chatbotId,
    });

    return { success: true };
  });
