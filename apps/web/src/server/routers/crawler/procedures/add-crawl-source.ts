import { protectedProcedure } from "@/server/trpc";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { chatbots, crawlSources } from "@teachanything/db/schema";
import { isUrlSafe } from "@teachanything/ai/crawler";
import { env } from "@/lib/env";
import { publishQStashJob } from "@/lib/qstash";
import { logInfo, logError } from "@/lib/logger";
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

    const safe = isUrlSafe(input.rootUrl);
    if (!safe) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "URL is not allowed",
      });
    }

    try {
      const response = await fetch(input.rootUrl, {
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
        message:
          "Could not reach that URL. Please check it's correct and publicly accessible.",
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

    if (env.NODE_ENV === "development") {
      logInfo("Processing crawl discovery inline (development mode)", {
        crawlSourceId: source.id,
        rootUrl: input.rootUrl,
      });

      import("@/lib/crawl-processor")
        .then(({ processCrawlDiscovery }) =>
          processCrawlDiscovery({ crawlSourceId: source.id }),
        )
        .catch((error) => {
          logError(error, "Inline crawl discovery failed", {
            crawlSourceId: source.id,
          });
        });
    } else {
      await publishQStashJob({
        url: `${env.NEXT_PUBLIC_APP_URL}/api/jobs/crawl-discover`,
        body: { crawlSourceId: source.id },
      });

      logInfo("Crawl discovery job published", {
        crawlSourceId: source.id,
        rootUrl: input.rootUrl,
      });
    }

    return source;
  });
