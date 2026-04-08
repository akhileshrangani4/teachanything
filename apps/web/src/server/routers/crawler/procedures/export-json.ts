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

    const rows = await ctx.db
      .select({
        pageUrl: crawledPages.url,
        pageTitle: crawledPages.title,
        pageWordCount: crawledPages.metadata,
        chunkContent: fileChunks.content,
        chunkIndex: fileChunks.chunkIndex,
      })
      .from(crawledPages)
      .leftJoin(fileChunks, eq(fileChunks.fileId, crawledPages.userFileId))
      .where(
        and(
          eq(crawledPages.crawlSourceId, input.crawlSourceId),
          eq(crawledPages.status, "completed"),
        ),
      )
      .orderBy(crawledPages.url, asc(fileChunks.chunkIndex))
      .limit(MAX_EXPORT_PAGES * 50);

    const pageMap = new Map<
      string,
      {
        url: string;
        title: string | null;
        wordCount?: number;
        chunks: string[];
      }
    >();

    for (const row of rows) {
      if (!pageMap.has(row.pageUrl)) {
        pageMap.set(row.pageUrl, {
          url: row.pageUrl,
          title: row.pageTitle,
          wordCount: (row.pageWordCount as { wordCount?: number })?.wordCount,
          chunks: [],
        });
      }
      if (row.chunkContent) {
        pageMap.get(row.pageUrl)!.chunks.push(row.chunkContent);
      }
    }

    const pages = [...pageMap.values()].slice(0, MAX_EXPORT_PAGES).map((p) => {
      const content = p.chunks.join("\n\n");
      return {
        url: p.url,
        title: p.title,
        content,
        wordCount: p.wordCount ?? content.split(/\s+/).filter(Boolean).length,
      };
    });

    return {
      source: source.rootUrl,
      crawledAt: source.lastCrawledAt,
      pageCount: pages.length,
      pages,
    };
  });
