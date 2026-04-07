import { protectedProcedure } from "@/server/trpc";
import { z } from "zod";
import { eq, and, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { chatbots, crawlSources, crawledPages } from "@teachanything/db/schema";

export const getCrawlSourcesProcedure = protectedProcedure
  .input(z.object({ chatbotId: z.string().uuid() }))
  .query(async ({ ctx, input }) => {
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

    const sources = await ctx.db
      .select()
      .from(crawlSources)
      .where(eq(crawlSources.chatbotId, input.chatbotId));

    const sourcesWithCounts = await Promise.all(
      sources.map(async (source) => {
        const [pending] = await ctx.db
          .select({ count: sql<number>`count(*)` })
          .from(crawledPages)
          .where(
            and(
              eq(crawledPages.crawlSourceId, source.id),
              eq(crawledPages.status, "pending"),
            ),
          );

        const [processing] = await ctx.db
          .select({ count: sql<number>`count(*)` })
          .from(crawledPages)
          .where(
            and(
              eq(crawledPages.crawlSourceId, source.id),
              eq(crawledPages.status, "processing"),
            ),
          );

        const [completed] = await ctx.db
          .select({ count: sql<number>`count(*)` })
          .from(crawledPages)
          .where(
            and(
              eq(crawledPages.crawlSourceId, source.id),
              eq(crawledPages.status, "completed"),
            ),
          );

        const [failed] = await ctx.db
          .select({ count: sql<number>`count(*)` })
          .from(crawledPages)
          .where(
            and(
              eq(crawledPages.crawlSourceId, source.id),
              eq(crawledPages.status, "failed"),
            ),
          );

        return {
          ...source,
          pageCounts: {
            pending: Number(pending?.count ?? 0),
            processing: Number(processing?.count ?? 0),
            completed: Number(completed?.count ?? 0),
            failed: Number(failed?.count ?? 0),
          },
        };
      }),
    );

    return sourcesWithCounts;
  });
