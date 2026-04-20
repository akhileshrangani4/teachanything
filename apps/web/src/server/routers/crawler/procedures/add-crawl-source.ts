import { protectedProcedure } from "@/server/trpc";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { chatbots, crawlSources } from "@teachanything/db/schema";
import { verifyUrlReachable } from "@teachanything/ai/crawler";
import { dispatchCrawlJob, processCrawlDiscovery } from "@/lib/crawl-processor";
import { checkRateLimit, crawlSourceRateLimit } from "@/lib/rate-limit";
import { crawlSourceInput } from "../validation";

export const addCrawlSourceProcedure = protectedProcedure
  .input(crawlSourceInput)
  .mutation(async ({ ctx, input }) => {
    const [chatbot] = await ctx.db
      .select()
      .from(chatbots)
      .where(
        and(
          eq(chatbots.id, input.chatbotId),
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
      crawlSourceRateLimit,
      ctx.session.user.id,
      { action: "addCrawlSource" },
    );
    if (!success) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "Too many crawl sources created. Please try again later.",
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
          eq(crawlSources.chatbotId, input.chatbotId),
          eq(crawlSources.rootUrl, input.rootUrl),
        ),
      )
      .limit(1);

    if (existing) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "A crawl source with this URL already exists for this chatbot",
      });
    }

    const [source] = await ctx.db
      .insert(crawlSources)
      .values({
        chatbotId: input.chatbotId,
        rootUrl: input.rootUrl,
        crawlDepth: input.crawlDepth,
        maxPages: input.maxPages,
        includePatterns: input.includePatterns,
        excludePatterns: input.excludePatterns,
        status: "pending",
        metadata: {},
      })
      .returning();

    if (!source) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to create crawl source",
      });
    }

    await dispatchCrawlJob({
      jobPath: "/api/jobs/crawl-discover",
      body: { crawlSourceId: source.id },
      inlineFn: () => processCrawlDiscovery({ crawlSourceId: source.id }),
      label: "Crawl discovery",
    });

    return source;
  });
