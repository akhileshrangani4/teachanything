import { protectedProcedure } from "@/server/trpc";
import { eq } from "drizzle-orm";
import { crawledPages, userFiles } from "@teachanything/db/schema";
import { renameCrawledPageInput } from "../validation";
import { assertOwnedCrawledPage } from "../helpers";
import { mergeCrawledPageMetadata } from "@/lib/crawler-metadata-sql";

export const renameCrawledPageProcedure = protectedProcedure
  .input(renameCrawledPageInput)
  .mutation(async ({ ctx, input }) => {
    const { page } = await assertOwnedCrawledPage(ctx, input.crawledPageId);
    const title = input.title.trim();

    await ctx.db.transaction(async (tx) => {
      await tx
        .update(crawledPages)
        .set({
          title,
          metadata: mergeCrawledPageMetadata({ customTitle: title }),
          updatedAt: new Date(),
        })
        .where(eq(crawledPages.id, input.crawledPageId));

      if (page.userFileId) {
        await tx
          .update(userFiles)
          .set({ fileName: title })
          .where(eq(userFiles.id, page.userFileId));
      }
    });

    return { id: input.crawledPageId, title };
  });
