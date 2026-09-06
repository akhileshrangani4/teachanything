import { eq, and, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
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
