import { protectedProcedure } from "@/server/trpc";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { chatbots, crawlSources } from "@teachanything/db/schema";
import { env } from "@/lib/env";
import { publishQStashJob } from "@/lib/qstash";
import { logInfo, logError } from "@/lib/logger";
import { checkRateLimit, recrawlRateLimit } from "@/lib/rate-limit";
import { crawlSourceIdInput } from "../validation";

export const recrawlProcedure = protectedProcedure
  .input(crawlSourceIdInput)
  .mutation(async ({ ctx, input }) => {
    const [source] = await ctx.db
      .select()
      .from(crawlSources)
      .where(eq(crawlSources.id, input.crawlSourceId))
      .limit(1);

    if (!source) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Crawl source not found",
      });
    }

    const [chatbot] = await ctx.db
      .select()
      .from(chatbots)
      .where(
        and(
          eq(chatbots.id, source.chatbotId),
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
      recrawlRateLimit,
      ctx.session.user.id,
      { action: "recrawl" },
    );
    if (!success) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "Too many recrawl requests. Please try again later.",
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
        metadata: {},
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

    if (env.NODE_ENV === "development") {
      logInfo("Processing recrawl discovery inline (development mode)", {
        crawlSourceId: source.id,
        rootUrl: source.rootUrl,
      });

      import("@/lib/crawl-processor")
        .then(({ processCrawlDiscovery }) =>
          processCrawlDiscovery({ crawlSourceId: source.id }),
        )
        .catch((error) => {
          logError(error, "Inline recrawl discovery failed", {
            crawlSourceId: source.id,
          });
        });
    } else {
      await publishQStashJob({
        url: `${env.NEXT_PUBLIC_APP_URL}/api/jobs/crawl-discover`,
        body: { crawlSourceId: source.id },
      });

      logInfo("Recrawl discovery job published", {
        crawlSourceId: source.id,
        rootUrl: source.rootUrl,
      });
    }

    return updatedSource;
  });
