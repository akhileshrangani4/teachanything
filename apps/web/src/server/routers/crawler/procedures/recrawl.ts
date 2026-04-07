import { protectedProcedure } from "@/server/trpc";
import { eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { chatbots, crawlSources } from "@teachanything/db/schema";
import { env } from "@/lib/env";
import { publishQStashJob } from "@/lib/qstash";
import { logInfo, logError } from "@/lib/logger";
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
