import { eq, and, inArray, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  chatbots,
  crawlSources,
  crawledPages,
  userFiles,
  chatbotFileAssociations,
} from "@teachanything/db/schema";
import type { db as dbType } from "@teachanything/db";
import type { Context } from "@/server/trpc";

// Narrowed context for helpers: only called from protectedProcedure, so
// the auth middleware has already verified session. Narrowing keeps the
// helper decoupled from non-user-id fields on Context.
type AuthedContext = Context & { session: { user: { id: string } } };

/**
 * Fetch a crawl source and verify the caller owns its parent chatbot.
 * Single query (source JOIN chatbot) instead of two sequential selects.
 * Throws NOT_FOUND if the source doesn't exist or the user doesn't own it.
 */
export async function assertOwnedCrawlSource(
  ctx: AuthedContext,
  crawlSourceId: string,
): Promise<typeof crawlSources.$inferSelect> {
  const [row] = await ctx.db
    .select({ source: crawlSources })
    .from(crawlSources)
    .innerJoin(chatbots, eq(chatbots.id, crawlSources.chatbotId))
    .where(
      and(
        eq(crawlSources.id, crawlSourceId),
        eq(chatbots.userId, ctx.session.user.id),
      ),
    )
    .limit(1);

  if (!row) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Crawl source not found",
    });
  }

  return row.source;
}

/**
 * Same as above but for a specific crawled page: verifies the caller owns
 * the chatbot that owns the parent crawl source.
 */
export async function assertOwnedCrawledPage(
  ctx: AuthedContext,
  crawledPageId: string,
): Promise<{
  page: typeof crawledPages.$inferSelect;
  source: typeof crawlSources.$inferSelect;
}> {
  const [row] = await ctx.db
    .select({ page: crawledPages, source: crawlSources })
    .from(crawledPages)
    .innerJoin(crawlSources, eq(crawlSources.id, crawledPages.crawlSourceId))
    .innerJoin(chatbots, eq(chatbots.id, crawlSources.chatbotId))
    .where(
      and(
        eq(crawledPages.id, crawledPageId),
        eq(chatbots.userId, ctx.session.user.id),
      ),
    )
    .limit(1);

  if (!row) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Crawled page not found",
    });
  }

  return row;
}

/**
 * Verifies the caller owns the given chatbot. Returns the chatbot row.
 */
export async function assertOwnedChatbot(
  ctx: AuthedContext,
  chatbotId: string,
): Promise<typeof chatbots.$inferSelect> {
  const [chatbot] = await ctx.db
    .select()
    .from(chatbots)
    .where(
      and(
        eq(chatbots.id, chatbotId),
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

  return chatbot;
}

/**
 * Delete chatbot-scoped crawler userFiles safely.
 *
 * Removes this chatbot's associations to the given fileIds and deletes any
 * resulting orphans (userFiles with no remaining associations). Does NOT
 * delete files that are still linked to other chatbots.
 *
 * Must be run inside a transaction (pass the tx handle).
 */
export async function deleteCrawlFileIds(
  tx: Parameters<Parameters<typeof dbType.transaction>[0]>[0],
  chatbotId: string,
  fileIds: string[],
): Promise<void> {
  if (fileIds.length === 0) return;

  // Step 1: remove this chatbot's associations to the target files.
  await tx
    .delete(chatbotFileAssociations)
    .where(
      and(
        eq(chatbotFileAssociations.chatbotId, chatbotId),
        inArray(chatbotFileAssociations.fileId, fileIds),
      ),
    );

  // Step 2: delete userFiles that are now fully orphaned (no remaining
  // associations to any chatbot). Uses NOT EXISTS in one round-trip
  // instead of a SELECT + client-side diff + DELETE.
  await tx
    .delete(userFiles)
    .where(
      and(
        inArray(userFiles.id, fileIds),
        sql`NOT EXISTS (SELECT 1 FROM ${chatbotFileAssociations} WHERE ${chatbotFileAssociations.fileId} = ${userFiles.id})`,
      ),
    );
}
