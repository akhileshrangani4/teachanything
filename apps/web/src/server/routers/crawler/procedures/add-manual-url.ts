import { protectedProcedure } from "@/server/trpc";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  crawlSources,
  crawledPages,
  chatbotCrawlSourceAssociations,
} from "@teachanything/db/schema";
import { verifyUrlReachable } from "@teachanything/ai/crawler";
import {
  dispatchCrawlJob,
  processCrawlPage,
  finalizeCrawlSource,
} from "@/lib/crawl-processor";
import { checkRateLimit, manualUrlRateLimit } from "@/lib/rate-limit";
import { assertOwnedChatbot } from "../helpers";
import { manualUrlInput } from "../validation";

export const addManualUrlProcedure = protectedProcedure
  .input(manualUrlInput)
  .mutation(async ({ ctx, input }) => {
    if (input.chatbotId) {
      await assertOwnedChatbot(ctx, input.chatbotId);
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
          eq(crawlSources.userId, ctx.session.user.id),
          eq(crawlSources.rootUrl, input.url),
        ),
      )
      .limit(1);

    if (existingSource) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "You've already added this URL as a web source",
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
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create crawl source",
        });
      }

      if (input.chatbotId) {
        await tx
          .insert(chatbotCrawlSourceAssociations)
          .values({ chatbotId: input.chatbotId, crawlSourceId: createdSource.id })
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
