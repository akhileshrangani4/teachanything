import { protectedProcedure } from "@/server/trpc";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { crawlSources } from "@teachanything/db/schema";
import { logInfo } from "@/lib/logger";
import { checkRateLimit, recrawlRateLimit } from "@/server/rate-limit";
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

    const { success } = await checkRateLimit(
      recrawlRateLimit,
      ctx.session.user.id,
      { action: "toggleCrawlSource" },
    );
    if (!success) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "Too many toggle requests. Please try again later.",
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
