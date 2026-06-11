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
 * Fetch a crawl source and verify the caller owns it via userId.
 * Throws NOT_FOUND if the source doesn't exist or the user doesn't own it.
 */
export async function assertOwnedCrawlSource(
  ctx: AuthedContext,
  crawlSourceId: string,
): Promise<typeof crawlSources.$inferSelect> {
  const [source] = await ctx.db
    .select()
    .from(crawlSources)
    .where(
      and(
        eq(crawlSources.id, crawlSourceId),
        eq(crawlSources.userId, ctx.session.user.id),
      ),
    )
    .limit(1);

  if (!source) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Crawl source not found",
    });
  }

  return source;
}

/**
 * Fetch a crawled page and verify the caller owns the parent crawl source
 * via userId (crawledPages -> crawlSources.userId).
 * Throws NOT_FOUND if the page doesn't exist or the user doesn't own it.
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
    .where(
      and(
        eq(crawledPages.id, crawledPageId),
        eq(crawlSources.userId, ctx.session.user.id),
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
      and(eq(chatbots.id, chatbotId), eq(chatbots.userId, ctx.session.user.id)),
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

/**
 * Delete crawler userFiles regardless of which chatbots they're attached to.
 * Removes ALL associations for the given fileIds, then deletes the userFiles
 * (they are exclusively owned by crawled pages). Use when removing a whole
 * crawl source or an individual page, where the page should disappear from
 * every chatbot it was attached to.
 *
 * Must be run inside a transaction (pass the tx handle).
 */
export async function deleteAllCrawlFileIds(
  tx: Parameters<Parameters<typeof dbType.transaction>[0]>[0],
  fileIds: string[],
): Promise<void> {
  if (fileIds.length === 0) return;

  await tx
    .delete(chatbotFileAssociations)
    .where(inArray(chatbotFileAssociations.fileId, fileIds));

  await tx.delete(userFiles).where(inArray(userFiles.id, fileIds));
}
