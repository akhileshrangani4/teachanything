import { db } from "@teachanything/db";
import {
  crawlSources,
  crawledPages,
  userFiles,
  fileChunks,
  chatbotFileAssociations,
  chatbotCrawlSourceAssociations,
} from "@teachanything/db/schema";
import { and, eq, inArray, lt, or, sql } from "drizzle-orm";
import {
  fetchAndExtractPage,
  fetchRobots,
  parseRobots,
  isRobotsAllowed,
  isUrlSafeWithDns,
} from "@teachanything/ai/crawler";
import { env } from "@/lib/env";
import { logInfo, logError } from "@/lib/logger";
import { mergeCrawledPageMetadata } from "../crawler-metadata-sql";
import { CrawledPageDeletedError, getFriendlyErrorMessage } from "./errors";

/**
 * The page statuses `processCrawlPage` claims unconditionally.
 *
 * `pending` is the normal dispatch state (both page-discovery and
 * add-manual-url set it before dispatching) and `failed` lets a QStash retry
 * re-attempt a transient failure. `completed` / `skipped` / `blocked` are
 * settled and never reclaimed: re-entering one of those is what orphans files.
 * `processing` is the interesting case, handled by the lease below.
 *
 * Exported for the test that pins it against the full crawled_page_status
 * enum, so adding a status forces a decision here rather than defaulting it
 * into the refused set by accident.
 */
export const CLAIMABLE_PAGE_STATUSES = ["pending", "failed"] as const;

/**
 * How long a `processing` claim is honoured before another delivery may take
 * the page over.
 *
 * Two very different situations both leave a row in `processing`, and the only
 * thing separating them is age:
 *
 *   - a duplicate QStash delivery arriving while the first worker is running.
 *     Seconds old. Must be refused, or both workers insert a `userFiles` row
 *     and the loser is orphaned -- the bug the conditional claim exists to fix.
 *   - a worker killed mid-run (the page job embeds every chunk and can exceed
 *     the function's budget). Minutes old, and nothing will ever finish it.
 *     Refusing this one costs the page its retry: it sits untouched until
 *     `sweepStaleCrawls` gives up and marks it `failed` 30 minutes later,
 *     where before the conditional claim a plain retry just re-processed it.
 *
 * So the predicate is "not `processing`, OR `processing` and older than the
 * lease". `updatedAt` is stamped once at claim and not touched again until the
 * page settles, so it measures exactly how long this claim has been held.
 *
 * CONSTRAINT: this MUST exceed `maxDuration` on
 * `app/api/jobs/crawl-process-page/route.ts` (300s). A lease shorter than the
 * function's own budget lets a retry reclaim a page whose first worker is
 * still alive and still about to insert, which is the duplicate bug again.
 * 10 minutes leaves 2x headroom. `crawl-page-lease.test.ts` pins the relation.
 */
export const PROCESSING_LEASE_MS = 10 * 60 * 1000;

/** Mark a page blocked (SSRF guard or robots.txt) and stop processing it. */
async function markPageBlocked(
  crawledPageId: string,
  error: string,
): Promise<void> {
  await db
    .update(crawledPages)
    .set({
      status: "blocked",
      metadata: mergeCrawledPageMetadata({ error }),
      updatedAt: new Date(),
    })
    .where(eq(crawledPages.id, crawledPageId));
}

export async function processCrawlPage(params: {
  crawledPageId: string;
}): Promise<void> {
  const { crawledPageId } = params;

  try {
    const [page] = await db
      .select()
      .from(crawledPages)
      .where(eq(crawledPages.id, crawledPageId))
      .limit(1);

    if (!page) {
      logInfo("Crawled page not found, skipping", { crawledPageId });
      return;
    }

    const [source] = await db
      .select()
      .from(crawlSources)
      .where(eq(crawlSources.id, page.crawlSourceId))
      .limit(1);

    if (!source) {
      logInfo("Crawl source not found, skipping", { crawledPageId });
      return;
    }

    // The source settled (stopped by the user, or timed out by the stale sweep)
    // while this job sat in the queue. Drain without reviving it.
    if (source.status !== "crawling" && source.status !== "discovering") {
      logInfo("Crawl no longer running, skipping page", {
        crawledPageId,
        status: source.status,
      });
      return;
    }

    if (!(await isUrlSafeWithDns(page.url))) {
      await markPageBlocked(
        crawledPageId,
        "URL targets a private or disallowed address",
      );
      return;
    }

    const cachedRobotsText = source.metadata?.robotsText ?? null;
    const robots =
      cachedRobotsText !== null
        ? parseRobots(source.rootUrl, cachedRobotsText)
        : await fetchRobots(source.rootUrl);
    if (!isRobotsAllowed(robots, page.url)) {
      await markPageBlocked(crawledPageId, "Blocked by robots.txt");
      return;
    }

    // Claim the page atomically. Without a status predicate two QStash
    // deliveries of the same page both proceed, both read `userFileId` as
    // null, and both insert a `userFiles` row -- the loser is orphaned,
    // carrying chunks and chatbot associations that nothing points at.
    //
    // Claimable: `pending` (the normal dispatch state) and `failed` (so a
    // retry can re-attempt a transient failure), plus a `processing` row whose
    // lease has expired, which means the worker holding it died without
    // reaching its catch. `completed` / `skipped` / `blocked` are settled and
    // a duplicate delivery for one of those is refused outright.
    // See PROCESSING_LEASE_MS for why the lease has to be longer than the
    // function's own budget.
    const leaseCutoff = new Date(Date.now() - PROCESSING_LEASE_MS);
    const claimed = await db
      .update(crawledPages)
      .set({ status: "processing", updatedAt: new Date() })
      .where(
        and(
          eq(crawledPages.id, crawledPageId),
          or(
            inArray(crawledPages.status, [...CLAIMABLE_PAGE_STATUSES]),
            and(
              eq(crawledPages.status, "processing"),
              lt(crawledPages.updatedAt, leaseCutoff),
            ),
          ),
        ),
      )
      .returning({ userFileId: crawledPages.userFileId });

    if (claimed.length === 0) {
      logInfo("Crawled page already claimed or settled, skipping", {
        crawledPageId,
        // Read before the claim, so in the racing case it reports the status
        // this worker saw rather than the one that refused it.
        statusBeforeClaim: page.status,
      });
      return;
    }
    // Read from the claim, not from the `page` row selected before it: the
    // claim is the point at which this worker's view of the row becomes
    // authoritative.
    const claimedUserFileId = claimed[0]!.userFileId;

    const pageContent = await fetchAndExtractPage(page.url);

    if (!pageContent) {
      await db
        .update(crawledPages)
        .set({
          status: "failed",
          metadata: mergeCrawledPageMetadata({
            error: "Failed to fetch or extract content",
          }),
          updatedAt: new Date(),
        })
        .where(eq(crawledPages.id, crawledPageId));
      return;
    }

    if (page.contentHash && page.contentHash === pageContent.contentHash) {
      await db
        .update(crawledPages)
        .set({ status: "skipped", updatedAt: new Date() })
        .where(eq(crawledPages.id, crawledPageId));
      return;
    }

    // Embedding + storage in a transaction to prevent orphaned data
    const { createRAGService, createOpenRouterClient } =
      await import("@teachanything/ai");
    const ragService = createRAGService();
    const chunks = await ragService.chunkText(pageContent.content);
    const openrouterClient = createOpenRouterClient(
      env.OPENROUTER_API_KEY,
      env.OPENAI_API_KEY,
    );

    // Embed BEFORE opening the transaction. These are network calls to the
    // embedding provider and can take minutes when the provider is slow or
    // rate-limiting; running them inside the transaction held the source's
    // share lock and a pooled connection for that whole time, and discovery
    // dispatches up to 20 page jobs concurrently. That was enough to exhaust
    // the connection pool and block source deletion.
    //
    // Nothing here writes, so a failure just throws to the catch below and the
    // page is marked failed, exactly as before. The transaction still covers
    // delete + insert + status atomically, which is the property that matters.
    const EMBED_BATCH_SIZE = 50;
    const embeddedChunks: {
      chunkIndex: number;
      content: string;
      embedding: number[];
      tokenCount: number;
    }[] = [];
    for (let i = 0; i < chunks.length; i += EMBED_BATCH_SIZE) {
      const batch = chunks.slice(i, i + EMBED_BATCH_SIZE);
      const batchEmbeddings = await ragService.generateEmbeddingsForChunks(
        batch,
        openrouterClient,
      );
      for (const [batchIdx, chunk] of batch.entries()) {
        embeddedChunks.push({
          chunkIndex: i + batchIdx,
          content: chunk,
          embedding: batchEmbeddings[batchIdx]!,
          tokenCount: await ragService.countTokens(chunk),
        });
      }
    }

    await db.transaction(async (tx) => {
      // Hold the source in share mode for the life of this transaction. A
      // delete takes the exclusive lock, so it cannot slip between the checks
      // below and the commit and strand the userFile we are about to create.
      await tx
        .select({ id: crawlSources.id })
        .from(crawlSources)
        .where(eq(crawlSources.id, source.id))
        .for("share");

      const [currentPage] = await tx
        .select({
          metadata: crawledPages.metadata,
        })
        .from(crawledPages)
        .where(eq(crawledPages.id, crawledPageId))
        .limit(1);

      // The source was deleted mid-flight and the cascade took this page with
      // it. Abort before creating the userFile -- otherwise the file and its
      // chunks are orphaned, unreachable from the crawledPages row that the
      // source-deletion cleanup walks.
      if (!currentPage) throw new CrawledPageDeletedError();

      const customTitle = currentPage?.metadata?.customTitle?.trim();
      const displayTitle = customTitle || pageContent.title || page.url;
      let userFileId = claimedUserFileId;
      if (!userFileId) {
        const [file] = await tx
          .insert(userFiles)
          .values({
            userId: source.userId,
            fileName: displayTitle,
            fileType: "text/html",
            fileSize: Buffer.byteLength(pageContent.content, "utf-8"),
            storagePath: page.url,
            processingStatus: "processing",
          })
          .returning();

        if (!file) throw new Error("Failed to create user file");
        userFileId = file.id;

        await tx
          .update(crawledPages)
          .set({ userFileId })
          .where(eq(crawledPages.id, crawledPageId));
      } else {
        await tx
          .update(userFiles)
          .set({
            fileName: displayTitle,
            fileSize: Buffer.byteLength(pageContent.content, "utf-8"),
            processingStatus: "processing",
          })
          .where(eq(userFiles.id, userFileId));
      }

      // Sync file associations to every chatbot the source is currently
      // attached to. Read attachments INSIDE the transaction so we reflect the
      // freshest committed attach/detach state, and run for both new and
      // re-crawled pages (idempotent via onConflictDoNothing) so a re-crawl
      // self-heals any association gap from an attach during this crawl.
      const attachedChatbots = await tx
        .select({ chatbotId: chatbotCrawlSourceAssociations.chatbotId })
        .from(chatbotCrawlSourceAssociations)
        .where(eq(chatbotCrawlSourceAssociations.crawlSourceId, source.id));
      if (attachedChatbots.length > 0) {
        await tx
          .insert(chatbotFileAssociations)
          .values(
            attachedChatbots.map((r) => ({
              chatbotId: r.chatbotId,
              fileId: userFileId as string,
            })),
          )
          .onConflictDoNothing();
      }

      // Delete old chunks before inserting new ones (atomic within transaction)
      await tx.delete(fileChunks).where(eq(fileChunks.fileId, userFileId));

      // Insert the pre-computed embeddings. Batched for statement size only --
      // no network calls happen inside the transaction.
      const INSERT_BATCH_SIZE = 50;
      for (let i = 0; i < embeddedChunks.length; i += INSERT_BATCH_SIZE) {
        await tx.insert(fileChunks).values(
          embeddedChunks.slice(i, i + INSERT_BATCH_SIZE).map((c) => ({
            fileId: userFileId as string,
            chunkIndex: c.chunkIndex,
            content: c.content,
            embedding: c.embedding,
            tokenCount: c.tokenCount,
          })),
        );
      }

      const [updatedPage] = await tx
        .update(crawledPages)
        .set({
          status: "completed",
          title: sql<string>`COALESCE(${crawledPages.metadata}->>'customTitle', ${pageContent.title}, ${page.url})`,
          contentHash: pageContent.contentHash,
          metadata: mergeCrawledPageMetadata({
            statusCode: pageContent.statusCode,
            contentType: pageContent.contentType,
            wordCount: pageContent.wordCount,
          }),
          updatedAt: new Date(),
        })
        .where(eq(crawledPages.id, crawledPageId))
        .returning({ title: crawledPages.title });

      await tx
        .update(userFiles)
        .set({
          fileName: updatedPage?.title ?? displayTitle,
          processingStatus: "completed",
          metadata: {
            chunkCount: chunks.length,
            processedAt: new Date().toISOString(),
          },
        })
        .where(eq(userFiles.id, userFileId));
    });

    logInfo("Crawled page processed", {
      crawledPageId,
      url: page.url,
      chunkCount: chunks.length,
    });
  } catch (error) {
    if (error instanceof CrawledPageDeletedError) {
      logInfo("Crawl source deleted during page processing, discarding", {
        crawledPageId,
      });
      return;
    }

    logError(error, "Crawl page processing failed", { crawledPageId });

    const [failedPage] = await db
      .select({ userFileId: crawledPages.userFileId })
      .from(crawledPages)
      .where(eq(crawledPages.id, crawledPageId))
      .limit(1);

    if (failedPage?.userFileId) {
      await db
        .update(userFiles)
        .set({ processingStatus: "failed" })
        .where(eq(userFiles.id, failedPage.userFileId));
    }

    await db
      .update(crawledPages)
      .set({
        status: "failed",
        metadata: mergeCrawledPageMetadata({
          error: getFriendlyErrorMessage(error),
        }),
        updatedAt: new Date(),
      })
      .where(eq(crawledPages.id, crawledPageId));
  }
}
