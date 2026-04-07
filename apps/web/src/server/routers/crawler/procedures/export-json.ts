import { protectedProcedure } from "@/server/trpc";
import { eq, and, asc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  chatbots,
  crawlSources,
  crawledPages,
  fileChunks,
} from "@teachanything/db/schema";
import { crawlSourceIdInput } from "../validation";

export const exportJsonProcedure = protectedProcedure
  .input(crawlSourceIdInput)
  .query(async ({ ctx, input }) => {
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

    const completedPages = await ctx.db
      .select()
      .from(crawledPages)
      .where(
        and(
          eq(crawledPages.crawlSourceId, input.crawlSourceId),
          eq(crawledPages.status, "completed"),
        ),
      );

    const pages = await Promise.all(
      completedPages.map(async (page) => {
        let content = "";

        if (page.userFileId) {
          const chunks = await ctx.db
            .select({ content: fileChunks.content })
            .from(fileChunks)
            .where(eq(fileChunks.fileId, page.userFileId))
            .orderBy(asc(fileChunks.chunkIndex));

          content = chunks.map((c) => c.content).join("\n\n");
        }

        return {
          url: page.url,
          title: page.title,
          content,
          wordCount: page.metadata?.wordCount ?? content.split(/\s+/).filter(Boolean).length,
        };
      }),
    );

    return {
      source: source.rootUrl,
      crawledAt: source.lastCrawledAt,
      pages,
    };
  });
