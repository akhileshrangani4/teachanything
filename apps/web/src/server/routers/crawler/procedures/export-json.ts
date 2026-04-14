import { protectedProcedure } from "@/server/trpc";
import { eq, and, asc, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  chatbots,
  crawlSources,
  crawledPages,
  fileChunks,
} from "@teachanything/db/schema";
import { crawlSourceIdInput } from "../validation";

const MAX_EXPORT_PAGES = 200;

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
      .select({
        id: crawledPages.id,
        url: crawledPages.url,
        title: crawledPages.title,
        metadata: crawledPages.metadata,
        userFileId: crawledPages.userFileId,
      })
      .from(crawledPages)
      .where(
        and(
          eq(crawledPages.crawlSourceId, input.crawlSourceId),
          eq(crawledPages.status, "completed"),
        ),
      )
      .orderBy(crawledPages.url)
      .limit(MAX_EXPORT_PAGES);

    const fileIds = completedPages
      .map((p) => p.userFileId)
      .filter((id): id is string => id !== null);

    const chunks =
      fileIds.length > 0
        ? await ctx.db
            .select({
              fileId: fileChunks.fileId,
              content: fileChunks.content,
              chunkIndex: fileChunks.chunkIndex,
            })
            .from(fileChunks)
            .where(inArray(fileChunks.fileId, fileIds))
            .orderBy(asc(fileChunks.chunkIndex))
        : [];

    const chunksByFileId = new Map<string, string[]>();
    for (const chunk of chunks) {
      const list = chunksByFileId.get(chunk.fileId) ?? [];
      list.push(chunk.content);
      chunksByFileId.set(chunk.fileId, list);
    }

    const pages = completedPages.map((p) => {
      const pageChunks = p.userFileId
        ? (chunksByFileId.get(p.userFileId) ?? [])
        : [];
      const content = pageChunks.join("\n\n");
      const wordCount =
        (p.metadata as { wordCount?: number } | null)?.wordCount ??
        content.split(/\s+/).filter(Boolean).length;
      return { url: p.url, title: p.title, content, wordCount };
    });

    return {
      source: source.rootUrl,
      crawledAt: source.lastCrawledAt,
      pageCount: pages.length,
      pages,
    };
  });
