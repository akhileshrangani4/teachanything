import { protectedProcedure } from "@/server/trpc";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { chatbots, crawlSources, crawledPages } from "@teachanything/db/schema";
import { verifyUrlReachable } from "@teachanything/ai/crawler";
import {
  dispatchCrawlJob,
  processCrawlPage,
  finalizeCrawlSource,
} from "@/lib/crawl-processor";
import { checkRateLimit, manualUrlRateLimit } from "@/lib/rate-limit";
import { manualUrlInput } from "../validation";

export const addManualUrlProcedure = protectedProcedure
  .input(manualUrlInput)
  .mutation(async ({ ctx, input }) => {
    const [chatbot] = await ctx.db
      .select()
      .from(chatbots)
      .where(
        and(
          eq(chatbots.id, input.chatbotId),
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

    const { success } = await checkRateLimit(
      manualUrlRateLimit,
      ctx.session.user.id,
      { action: "addManualUrl" },
    );
    if (!success) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "Too many manual URL additions. Please try again later.",
      });
    }

    const [existingSource] = await ctx.db
      .select()
      .from(crawlSources)
      .where(
        and(
          eq(crawlSources.chatbotId, input.chatbotId),
          eq(crawlSources.rootUrl, input.url),
        ),
      )
      .limit(1);

    if (existingSource) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "This URL has already been added to this chatbot",
      });
    }

    try {
      await verifyUrlReachable(input.url);
    } catch (e) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          e instanceof Error
            ? e.message
            : "Could not reach that URL. Please check it's correct and publicly accessible.",
      });
    }

    const [source] = await ctx.db
      .insert(crawlSources)
      .values({
        chatbotId: input.chatbotId,
        rootUrl: input.url,
        crawlDepth: 0,
        maxPages: 1,
        includePatterns: [],
        excludePatterns: [],
        status: "crawling",
        metadata: {},
      })
      .returning();

    if (!source) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to create crawl source",
      });
    }

    const [page] = await ctx.db
      .insert(crawledPages)
      .values({
        crawlSourceId: source.id,
        url: input.url,
        depth: 0,
        status: "pending",
        metadata: {},
      })
      .returning();

    if (!page) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to create crawled page record",
      });
    }

    await dispatchCrawlJob({
      jobPath: "/api/jobs/crawl-process-page",
      body: { crawledPageId: page.id },
      inlineFn: async () => {
        await processCrawlPage({ crawledPageId: page.id });
        await finalizeCrawlSource(source.id);
      },
      label: "Crawl page processing",
    });

    return source;
  });
