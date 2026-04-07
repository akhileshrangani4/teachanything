import { protectedProcedure } from "@/server/trpc";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { chatbots, crawlSources, crawledPages } from "@teachanything/db/schema";
import { isUrlSafe } from "@teachanything/ai/crawler";
import { env } from "@/lib/env";
import { publishQStashJob } from "@/lib/qstash";
import { logInfo, logError } from "@/lib/logger";
import { manualUrlInput } from "../validation";

export const addManualUrlProcedure = protectedProcedure
  .input(manualUrlInput)
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

    const safe = isUrlSafe(input.url);
    if (!safe) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "URL is not allowed",
      });
    }

    try {
      const response = await fetch(input.url, {
        method: "HEAD",
        headers: { "User-Agent": "TeachAnythingBot/1.0" },
        signal: AbortSignal.timeout(10000),
        redirect: "follow",
      });
      if (!response.ok) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Could not reach that URL (${response.status}). Please check it's correct and publicly accessible.`,
        });
      }
    } catch (e) {
      if (e instanceof TRPCError) throw e;
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Could not reach that URL. Please check it's correct and publicly accessible.",
      });
    }

    const [source] = await ctx.db
      .insert(crawlSources)
      .values({
        chatbotId: input.chatbotId,
        rootUrl: input.url,
        crawlDepth: 0,
        maxPages: 1,
        includePatterns: [],
        excludePatterns: [],
        status: "crawling",
        metadata: {},
      })
      .returning();

    if (!source) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to create crawl source",
      });
    }

    const [page] = await ctx.db
      .insert(crawledPages)
      .values({
        crawlSourceId: source.id,
        url: input.url,
        depth: 0,
        status: "pending",
        metadata: {},
      })
      .returning();

    if (!page) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to create crawled page record",
      });
    }

    if (env.NODE_ENV === "development") {
      logInfo("Processing crawl page inline (development mode)", {
        crawlSourceId: source.id,
        crawledPageId: page.id,
        url: input.url,
      });

      import("@/lib/crawl-processor")
        .then(({ processCrawlPage }) =>
          processCrawlPage({ crawledPageId: page.id }),
        )
        .catch((error) => {
          logError(error, "Inline crawl page processing failed", {
            crawledPageId: page.id,
          });
        });
    } else {
      await publishQStashJob({
        url: `${env.NEXT_PUBLIC_APP_URL}/api/jobs/crawl-process-page`,
        body: { crawledPageId: page.id },
      });

      logInfo("Crawl page processing job published", {
        crawlSourceId: source.id,
        crawledPageId: page.id,
        url: input.url,
      });
    }

    return source;
  });
