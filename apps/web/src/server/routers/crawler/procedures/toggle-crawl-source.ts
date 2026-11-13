import { protectedProcedure } from "@/server/trpc";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { crawlSources } from "@teachanything/db/schema";
import { logInfo } from "@/lib/logger";
import { checkRateLimit, recrawlRateLimit } from "@/server/rate-limit";
import { retryAfterMinutes } from "@/lib/constants/rate-limits";
import { assertOwnedCrawlSource } from "../helpers";
import { appError } from "@/server/app-error";

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
      throw appError("TOO_MANY_REQUESTS", "errors.tooManyRequestsIn", {
        minutes: retryAfterMinutes(reset),
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
