import { protectedProcedure } from "@/server/trpc";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { crawlSources } from "@teachanything/db/schema";
import { logInfo } from "@/lib/logger";
import { checkRateLimit, recrawlRateLimit } from "@/lib/rate-limit";
import { formatRetryAfter } from "@/lib/constants/rate-limits";
import { assertOwnedCrawlSource } from "../helpers";

export const toggleCrawlSourceProcedure = protectedProcedure
  .input(
    z.object({
      crawlSourceId: z.string().uuid(),
      enabled: z.boolean(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    await assertOwnedCrawlSource(ctx, input.crawlSourceId);

    const { success, reset } = await checkRateLimit(
      recrawlRateLimit,
      ctx.session.user.id,
      { action: "toggleCrawlSource" },
    );
    if (!success) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: `Too many requests. Please try again in ${formatRetryAfter(reset)}.`,
      });
    }

    const [updated] = await ctx.db
      .update(crawlSources)
      .set({ enabled: input.enabled, updatedAt: new Date() })
      .where(eq(crawlSources.id, input.crawlSourceId))
      .returning();

    logInfo("Crawl source toggled", {
      crawlSourceId: input.crawlSourceId,
      enabled: input.enabled,
    });

    return updated;
  });
