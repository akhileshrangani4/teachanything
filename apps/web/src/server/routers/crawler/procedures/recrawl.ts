import { protectedProcedure } from "@/server/trpc";
import { eq, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { crawlSources } from "@teachanything/db/schema";
import { dispatchCrawlJob, processCrawlDiscovery } from "@/lib/crawl-processor";
import { checkRateLimit, recrawlRateLimit } from "@/lib/rate-limit";
import {
  RECRAWLS_PER_HOUR,
  formatRetryAfter,
} from "@/lib/constants/rate-limits";
import { crawlSourceIdInput } from "../validation";
import { assertOwnedCrawlSource } from "../helpers";

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
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: `You've reached the hourly limit of ${RECRAWLS_PER_HOUR} re-crawls. You can re-crawl again in ${formatRetryAfter(reset)}.`,
      });
    }

    if (["pending", "discovering", "crawling"].includes(source.status)) {
      const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
      const stuckThreshold = new Date(Date.now() - TWO_HOURS_MS);
      const isStuck =
        source.updatedAt !== null && source.updatedAt < stuckThreshold;
      if (!isStuck) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A crawl is already in progress",
        });
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
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to update crawl source",
      });
    }

    await dispatchCrawlJob({
      jobPath: "/api/jobs/crawl-discover",
      body: { crawlSourceId: source.id },
      inlineFn: () => processCrawlDiscovery({ crawlSourceId: source.id }),
      label: "Recrawl discovery",
    });

    return updatedSource;
  });
