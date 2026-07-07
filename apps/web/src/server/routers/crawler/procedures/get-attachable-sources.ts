import { protectedProcedure } from "@/server/trpc";
import { z } from "zod";
import { and, eq, not, sql, desc } from "drizzle-orm";
import {
  crawlSources,
  chatbotCrawlSourceAssociations,
} from "@teachanything/db/schema";
import { assertOwnedChatbot } from "../helpers";

// Lists the caller's web sources with a flag for whether each is already
// attached to the given chatbot. Powers the "Attach existing web source"
// picker on a chatbot's Web Sources tab.
export const getAttachableSourcesProcedure = protectedProcedure
  .input(z.object({ chatbotId: z.string().uuid() }))
  .query(async ({ ctx, input }) => {
    await assertOwnedChatbot(ctx, input.chatbotId);

    const attachedExpr = sql<boolean>`EXISTS (
      SELECT 1 FROM ${chatbotCrawlSourceAssociations}
      WHERE ${chatbotCrawlSourceAssociations.crawlSourceId} = ${crawlSources.id}
        AND ${chatbotCrawlSourceAssociations.chatbotId} = ${input.chatbotId}
    )`;

    // Pull only the renamed display name out of metadata rather than the
    // whole JSONB blob (which can carry large robotsText/errors fields).
    const displayNameExpr = sql<
      string | null
    >`${crawlSources.metadata} ->> 'displayName'`;

    const rows = await ctx.db
      .select({
        id: crawlSources.id,
        rootUrl: crawlSources.rootUrl,
        displayName: displayNameExpr,
        status: crawlSources.status,
        createdAt: crawlSources.createdAt,
        isAttached: attachedExpr,
      })
      .from(crawlSources)
      // Only offer sources not already attached to this chatbot.
      .where(
        and(eq(crawlSources.userId, ctx.session.user.id), not(attachedExpr)),
      )
      .orderBy(desc(crawlSources.createdAt), desc(crawlSources.id));

    return rows;
  });
