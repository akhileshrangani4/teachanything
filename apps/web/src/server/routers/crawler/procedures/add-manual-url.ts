import { protectedProcedure } from "@/server/trpc";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  crawlSources,
  crawledPages,
  chatbotCrawlSourceAssociations,
} from "@teachanything/db/schema";
import { assertUrlReachable } from "../url-reachability";
import {
  dispatchCrawlJob,
  processCrawlPage,
  finalizeCrawlSource,
} from "@/server/crawl-processor";
import { checkRateLimit, manualUrlRateLimit } from "@/server/rate-limit";
import { assertOwnedChatbot } from "@/server/queries/chatbot";
import {
  MANUAL_URLS_PER_HOUR,
  retryAfterMinutes,
} from "@/lib/constants/rate-limits";
import { manualUrlInput } from "../validation";
import { appError } from "@/server/app-error";

export const addManualUrlProcedure = protectedProcedure
  .input(manualUrlInput)
  .mutation(async ({ ctx, input }) => {
    if (input.chatbotId) {
      await assertOwnedChatbot(ctx, input.chatbotId);
    }

    const { success, reset } = await checkRateLimit(
      manualUrlRateLimit,
      ctx.session.user.id,
      { action: "addManualUrl" },
    );
    if (!success) {
      throw appError("TOO_MANY_REQUESTS", "errors.rateLimits.singlePages", {
        limit: MANUAL_URLS_PER_HOUR,
        minutes: retryAfterMinutes(reset),
      });
    }

    const [existingSource] = await ctx.db
      .select()
      .from(crawlSources)
      .where(
        and(
          eq(crawlSources.userId, ctx.session.user.id),
          eq(crawlSources.rootUrl, input.url),
        ),
      )
      .limit(1);

    if (existingSource) {
      throw appError("CONFLICT", "errors.crawler.duplicateUrl");
    }

    await assertUrlReachable(input.url);

    const { source, page } = await ctx.db.transaction(async (tx) => {
      const [createdSource] = await tx
        .insert(crawlSources)
        .values({
          userId: ctx.session.user.id,
          rootUrl: input.url,
          crawlDepth: 0,
          maxPages: 1,
          includePatterns: [],
          excludePatterns: [],
          status: "crawling",
          metadata: {},
        })
        .returning();

      if (!createdSource) {
        throw appError("INTERNAL_SERVER_ERROR", "errors.crawler.createFailed");
      }

      if (input.chatbotId) {
        await tx
          .insert(chatbotCrawlSourceAssociations)
          .values({
            chatbotId: input.chatbotId,
            crawlSourceId: createdSource.id,
          })
          .onConflictDoNothing();
      }

      const [createdPage] = await tx
        .insert(crawledPages)
        .values({
          crawlSourceId: createdSource.id,
          url: input.url,
          depth: 0,
          status: "pending",
          metadata: {},
        })
        .returning();

      if (!createdPage) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create crawled page record",
        });
      }

      return { source: createdSource, page: createdPage };
    });

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
