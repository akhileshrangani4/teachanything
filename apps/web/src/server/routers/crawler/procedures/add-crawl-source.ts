import { protectedProcedure } from "@/server/trpc";
import { eq, and } from "drizzle-orm";
import {
  crawlSources,
  chatbotCrawlSourceAssociations,
} from "@teachanything/db/schema";
import { assertUrlReachable } from "../url-reachability";
import {
  dispatchCrawlJob,
  processCrawlDiscovery,
} from "@/server/crawl-processor";
import { checkRateLimit, crawlSourceRateLimit } from "@/server/rate-limit";
import { assertOwnedChatbot } from "@/server/queries/chatbot";
import {
  CRAWL_SOURCES_PER_HOUR,
  retryAfterMinutes,
} from "@/lib/constants/rate-limits";
import { crawlSourceInput } from "../validation";
import { appError } from "@/server/app-error";

export const addCrawlSourceProcedure = protectedProcedure
  .input(crawlSourceInput)
  .mutation(async ({ ctx, input }) => {
    if (input.chatbotId) {
      await assertOwnedChatbot(ctx, input.chatbotId);
    }

    const { success, reset } = await checkRateLimit(
      crawlSourceRateLimit,
      ctx.session.user.id,
      { action: "addCrawlSource" },
    );
    if (!success) {
      throw appError("TOO_MANY_REQUESTS", "errors.rateLimits.fullCrawls", {
        limit: CRAWL_SOURCES_PER_HOUR,
        minutes: retryAfterMinutes(reset),
      });
    }

    await assertUrlReachable(input.rootUrl);

    const [existing] = await ctx.db
      .select()
      .from(crawlSources)
      .where(
        and(
          eq(crawlSources.userId, ctx.session.user.id),
          eq(crawlSources.rootUrl, input.rootUrl),
        ),
      )
      .limit(1);

    if (existing) {
      throw appError("CONFLICT", "errors.crawler.duplicateUrl");
    }

    const source = await ctx.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(crawlSources)
        .values({
          userId: ctx.session.user.id,
          rootUrl: input.rootUrl,
          crawlDepth: input.crawlDepth,
          maxPages: input.maxPages,
          includePatterns: input.includePatterns,
          excludePatterns: input.excludePatterns,
          status: "pending",
          metadata: {},
        })
        .returning();

      if (!created) {
        throw appError("INTERNAL_SERVER_ERROR", "errors.crawler.createFailed");
      }

      if (input.chatbotId) {
        await tx
          .insert(chatbotCrawlSourceAssociations)
          .values({ chatbotId: input.chatbotId, crawlSourceId: created.id })
          .onConflictDoNothing();
      }

      return created;
    });

    await dispatchCrawlJob({
      jobPath: "/api/jobs/crawl-discover",
      body: { crawlSourceId: source.id },
      inlineFn: () => processCrawlDiscovery({ crawlSourceId: source.id }),
      label: "Crawl discovery",
    });

    return source;
  });
