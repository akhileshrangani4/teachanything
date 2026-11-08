import { protectedProcedure } from "@/server/trpc";
import { eq, sql } from "drizzle-orm";
import { crawlSources } from "@teachanything/db/schema";
import {
  dispatchCrawlJob,
  processCrawlDiscovery,
} from "@/server/crawl-processor";
import { checkRateLimit, recrawlRateLimit } from "@/server/rate-limit";
import {
  RECRAWLS_PER_HOUR,
  retryAfterMinutes,
} from "@/lib/constants/rate-limits";
import { crawlSourceIdInput } from "../validation";
import { assertOwnedCrawlSource } from "../helpers";
import { appError } from "@/server/app-error";

export const recrawlProcedure = protectedProcedure
  .input(crawlSourceIdInput)
  .mutation(async ({ ctx, input }) => {
    const source = await assertOwnedCrawlSource(ctx, input.crawlSourceId);

    const { success, reset } = await checkRateLimit(
      recrawlRateLimit,
      ctx.session.user.id,
      { action: "recrawl" },
    );
    if (!success) {
      throw appError("TOO_MANY_REQUESTS", "errors.rateLimits.recrawls", {
        limit: RECRAWLS_PER_HOUR,
        minutes: retryAfterMinutes(reset),
      });
    }

    if (["pending", "discovering", "crawling"].includes(source.status)) {
      const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
      const stuckThreshold = new Date(Date.now() - TWO_HOURS_MS);
      const isStuck =
        source.updatedAt !== null && source.updatedAt < stuckThreshold;
      if (!isStuck) {
        throw appError("CONFLICT", "errors.crawler.crawlInProgress");
      }
    }

    const [updatedSource] = await ctx.db
      .update(crawlSources)
      .set({
        status: "pending",
        metadata: sql`jsonb_strip_nulls(jsonb_build_object('displayName', ${crawlSources.metadata}->>'displayName'))`,
        updatedAt: new Date(),
      })
      .where(eq(crawlSources.id, input.crawlSourceId))
      .returning();

    if (!updatedSource) {
      throw appError("INTERNAL_SERVER_ERROR", "errors.crawler.updateFailed");
    }

    await dispatchCrawlJob({
      jobPath: "/api/jobs/crawl-discover",
      body: { crawlSourceId: source.id },
      inlineFn: () => processCrawlDiscovery({ crawlSourceId: source.id }),
      label: "Recrawl discovery",
    });

    return updatedSource;
  });
