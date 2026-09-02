import { db } from "@teachanything/db";
import {
  crawlSources,
  crawledPages,
  userFiles,
  fileChunks,
  chatbotFileAssociations,
  chatbotCrawlSourceAssociations,
} from "@teachanything/db/schema";
import { eq, sql } from "drizzle-orm";
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

    await db
      .update(crawledPages)
      .set({ status: "processing", updatedAt: new Date() })
      .where(eq(crawledPages.id, crawledPageId));

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
      let userFileId = page.userFileId;
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

      // Generate embeddings and insert in batches to limit memory
      const EMBED_BATCH_SIZE = 50;
      for (let i = 0; i < chunks.length; i += EMBED_BATCH_SIZE) {
        const batch = chunks.slice(i, i + EMBED_BATCH_SIZE);
        const batchEmbeddings = await ragService.generateEmbeddingsForChunks(
          batch,
          openrouterClient,
        );

        const chunkRecords = await Promise.all(
          batch.map(async (chunk, batchIdx) => ({
            fileId: userFileId,
            chunkIndex: i + batchIdx,
            content: chunk,
            embedding: batchEmbeddings[batchIdx],
            tokenCount: await ragService.countTokens(chunk),
          })),
        );

        await tx.insert(fileChunks).values(chunkRecords);
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
