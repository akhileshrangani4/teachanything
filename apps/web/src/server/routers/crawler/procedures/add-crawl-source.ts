import { protectedProcedure } from "@/server/trpc";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  crawlSources,
  chatbotCrawlSourceAssociations,
} from "@teachanything/db/schema";
import { verifyUrlReachable } from "@teachanything/ai/crawler";
import { dispatchCrawlJob, processCrawlDiscovery } from "@/lib/crawl-processor";
import { checkRateLimit, crawlSourceRateLimit } from "@/lib/rate-limit";
import {
  CRAWL_SOURCES_PER_HOUR,
  formatRetryAfter,
} from "@/lib/constants/rate-limits";
import { assertOwnedChatbot } from "../helpers";
import { crawlSourceInput } from "../validation";

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
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: `You've reached the hourly limit of ${CRAWL_SOURCES_PER_HOUR} full website crawls. This is an hourly limit, not a total cap on web sources. You can start another crawl in ${formatRetryAfter(reset)}.`,
      });
    }

    try {
      await verifyUrlReachable(input.rootUrl);
    } catch (e) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          e instanceof Error
            ? e.message
            : "Could not reach that URL. Please check it's correct and publicly accessible.",
      });
    }

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
      throw new TRPCError({
        code: "CONFLICT",
        message: "You've already added this URL as a web source",
      });
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
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create crawl source",
        });
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
