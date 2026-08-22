import { db } from "@teachanything/db";
import {
  crawlSources,
  crawledPages,
  userFiles,
  fileChunks,
  chatbotFileAssociations,
  chatbotCrawlSourceAssociations,
} from "@teachanything/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import {
  discoverPages,
  fetchAndExtractPage,
  fetchRobots,
  fetchRobotsText,
  parseRobots,
  isRobotsAllowed,
  isUrlSafeWithDns,
} from "@teachanything/ai/crawler";
import { env } from "@/lib/env";
import { publishQStashJob } from "./qstash";
import { logInfo, logError } from "@/lib/logger";
import {
  mergeCrawledPageMetadata,
  mergeCrawlSourceMetadata,
} from "./crawler-metadata-sql";

/**
 * Dispatch a crawl job: runs inline in development, publishes to QStash in production.
 * Fire-and-forget in dev to match production's QStash semantics (QStash returns
 * immediately after queueing). This keeps UI mutations responsive -- the caller
 * returns right away and the crawl progresses in the background.
 */
export async function dispatchCrawlJob(opts: {
  jobPath: string;
  body: Record<string, string>;
  inlineFn: () => Promise<void>;
  label: string;
}): Promise<void> {
  if (env.NODE_ENV === "development") {
    logInfo(`${opts.label} inline (development mode)`, opts.body);
    // Fire-and-forget: don't await, match QStash queue semantics
    void opts.inlineFn().catch((error) => {
      logError(error, `Inline ${opts.label} failed`, opts.body);
    });
  } else {
    await publishQStashJob({
      url: `${env.NEXT_PUBLIC_APP_URL}${opts.jobPath}`,
      body: opts.body,
    });
    logInfo(`${opts.label} job published`, opts.body);
  }
}

/**
 * Signals that the source stopped being ours to advance -- stopped by the user
 * or timed out by the stale sweep -- so the caller unwinds without writing a
 * failure over the status that already settled it.
 */
class CrawlNoLongerRunningError extends Error {
  constructor() {
    super("Crawl is no longer running");
    this.name = "CrawlNoLongerRunningError";
  }
}

/**
 * Signals that the page vanished under us because the user deleted its source.
 * That is a normal outcome now that deletion is allowed mid-crawl, so it
 * unwinds the transaction without taking the failure path.
 */
class CrawledPageDeletedError extends Error {
  constructor() {
    super("Crawled page was deleted while it was being processed");
    this.name = "CrawledPageDeletedError";
  }
}

function getFriendlyErrorMessage(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  if (msg.includes("Incorrect API key") || msg.includes("API key"))
    return "Embedding failed: invalid API key. Please check your OpenAI key.";
  if (msg.includes("ECONNREFUSED") || msg.includes("ENOTFOUND"))
    return "Could not connect to the page. The site may be down or blocking requests.";
  if (msg.includes("timeout") || msg.includes("ETIMEDOUT"))
    return "The page took too long to respond.";
  if (msg.includes("robots.txt") || msg.includes("disallowed"))
    return "This page is blocked by the site's robots.txt.";
  if (msg.includes("404") || msg.includes("Not Found"))
    return "Page not found (404).";
  if (msg.includes("403") || msg.includes("Forbidden"))
    return "Access to this page is forbidden (403).";
  if (msg.includes("429") || msg.includes("Too Many Requests"))
    return "Rate limited by the site. Try again later.";
  if (msg.includes("No content") || msg.includes("empty"))
    return "No readable content found on this page.";
  return "Failed to process this page. It may be unavailable or unsupported.";
}

export async function processCrawlDiscovery(params: {
  crawlSourceId: string;
}): Promise<void> {
  const { crawlSourceId } = params;

  try {
    const [source] = await db
      .select()
      .from(crawlSources)
      .where(eq(crawlSources.id, crawlSourceId))
      .limit(1);

    if (!source) {
      logInfo("Crawl source not found, skipping", { crawlSourceId });
      return;
    }

    // Only claim a source that is still waiting to be crawled. `discovering`
    // stays claimable so a QStash redelivery can resume after a worker died
    // mid-run, but a source the user stopped is left alone.
    const claimed = await db
      .update(crawlSources)
      .set({ status: "discovering", updatedAt: new Date() })
      .where(
        and(
          eq(crawlSources.id, crawlSourceId),
          inArray(crawlSources.status, ["pending", "discovering"]),
        ),
      )
      .returning({ id: crawlSources.id });

    if (claimed.length === 0) {
      logInfo("Crawl no longer running, skipping discovery", {
        crawlSourceId,
        status: source.status,
      });
      return;
    }

    const robotsText = await fetchRobotsText(source.rootUrl);

    // Must stay comfortably under the route's maxDuration (300s) -- if the
    // platform kills the function first, the abort handler never runs and the
    // source is left stuck in `discovering` forever. The remaining headroom
    // covers publishing the page jobs below.
    const DISCOVERY_TIMEOUT_MS = 3 * 60 * 1000;
    const abortController = new AbortController();
    const timeoutId = setTimeout(
      () => abortController.abort(),
      DISCOVERY_TIMEOUT_MS,
    );

    let discovered: Awaited<ReturnType<typeof discoverPages>>;
    try {
      discovered = await discoverPages({
        rootUrl: source.rootUrl,
        maxDepth: source.crawlDepth,
        maxPages: source.maxPages,
        includePatterns: source.includePatterns ?? [],
        excludePatterns: source.excludePatterns ?? [],
        signal: abortController.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (discovered.length === 0) {
      await db
        .update(crawlSources)
        .set({
          status: "failed",
          metadata: mergeCrawlSourceMetadata({
            pageCount: 0,
            errorCount: 1,
            errors: [
              {
                url: source.rootUrl,
                error:
                  "No pages could be scraped. The site may require JavaScript to render content.",
              },
            ],
          }),
          updatedAt: new Date(),
        })
        // Same guard as the catch below: a source stopped mid-discovery keeps
        // the status the stop gave it.
        .where(
          and(
            eq(crawlSources.id, crawlSourceId),
            inArray(crawlSources.status, [
              "pending",
              "discovering",
              "crawling",
            ]),
          ),
        );
      return;
    }

    const existingPages = await db
      .select({
        url: crawledPages.url,
        id: crawledPages.id,
        contentHash: crawledPages.contentHash,
      })
      .from(crawledPages)
      .where(eq(crawledPages.crawlSourceId, crawlSourceId));

    const existingPageMap = new Map(existingPages.map((p) => [p.url, p]));

    // Split discovered pages into existing (need update) and new (need insert)
    const toUpdate: { id: string; url: string; depth: number }[] = [];
    const toInsert: { url: string; depth: number }[] = [];

    for (const page of discovered) {
      const existing = existingPageMap.get(page.url);
      if (existing) {
        toUpdate.push({ id: existing.id, url: page.url, depth: page.depth });
      } else {
        toInsert.push({ url: page.url, depth: page.depth });
      }
    }

    // Wrap page upserts + status transition in a transaction so we don't
    // end up with pages inserted but source stuck in "discovering"
    const pageRecords = await db.transaction(async (tx) => {
      if (toUpdate.length > 0) {
        const updateIds = toUpdate.map((p) => p.id);
        await tx
          .update(crawledPages)
          .set({
            status: "pending",
            updatedAt: new Date(),
          })
          .where(inArray(crawledPages.id, updateIds));
      }

      const insertedPages: { id: string; url: string }[] = [];
      if (toInsert.length > 0) {
        const INSERT_BATCH_SIZE = 100;
        for (let i = 0; i < toInsert.length; i += INSERT_BATCH_SIZE) {
          const batch = toInsert.slice(i, i + INSERT_BATCH_SIZE);
          const rows = await tx
            .insert(crawledPages)
            .values(
              batch.map((p) => ({
                crawlSourceId,
                url: p.url,
                depth: p.depth,
                status: "pending" as const,
              })),
            )
            .onConflictDoUpdate({
              target: [crawledPages.crawlSourceId, crawledPages.url],
              set: {
                status: "pending" as const,
                updatedAt: new Date(),
              },
            })
            .returning({ id: crawledPages.id, url: crawledPages.url });
          insertedPages.push(...rows);
        }
      }

      const records = [
        ...toUpdate.map((p) => ({ id: p.id, url: p.url })),
        ...insertedPages,
      ];

      const started = await tx
        .update(crawlSources)
        .set({
          status: "crawling",
          metadata: mergeCrawlSourceMetadata({
            pageCount: records.length,
            errorCount: 0,
            errors: [],
            robotsText,
          }),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(crawlSources.id, crawlSourceId),
            eq(crawlSources.status, "discovering"),
          ),
        )
        .returning({ id: crawlSources.id });

      // Stopped while discovery was running. Throwing rolls back the page
      // upserts above so no work is queued against a source the user ended.
      if (started.length === 0) throw new CrawlNoLongerRunningError();

      return records;
    });

    const isDevMode = env.NODE_ENV === "development";

    if (isDevMode) {
      for (const page of pageRecords) {
        try {
          await processCrawlPage({ crawledPageId: page.id });
        } catch (error) {
          logError(error, "Inline crawl page processing failed", {
            crawledPageId: page.id,
          });
        }
      }
      await finalizeCrawlSource(crawlSourceId);
    } else {
      const BATCH_SIZE = 20;
      for (let i = 0; i < pageRecords.length; i += BATCH_SIZE) {
        const batch = pageRecords.slice(i, i + BATCH_SIZE);
        await Promise.all(
          batch.map((page) =>
            publishQStashJob({
              url: `${env.NEXT_PUBLIC_APP_URL}/api/jobs/crawl-process-page`,
              body: { crawledPageId: page.id },
            }),
          ),
        );
      }
    }
  } catch (error) {
    if (error instanceof CrawlNoLongerRunningError) {
      logInfo("Crawl stopped during discovery, discarding results", {
        crawlSourceId,
      });
      return;
    }

    logError(error, "Crawl discovery failed", { crawlSourceId });
    await db
      .update(crawlSources)
      .set({
        status: "failed",
        metadata: mergeCrawlSourceMetadata({
          errors: [{ url: "discovery", error: getFriendlyErrorMessage(error) }],
        }),
        updatedAt: new Date(),
      })
      // A source that already settled keeps its status -- a discovery error
      // must not resurrect it as a fresh failure.
      .where(
        and(
          eq(crawlSources.id, crawlSourceId),
          inArray(crawlSources.status, ["pending", "discovering", "crawling"]),
        ),
      );
  }
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
      await db
        .update(crawledPages)
        .set({
          status: "blocked",
          metadata: mergeCrawledPageMetadata({
            error: "URL targets a private or disallowed address",
          }),
          updatedAt: new Date(),
        })
        .where(eq(crawledPages.id, crawledPageId));
      return;
    }

    const cachedRobotsText = source.metadata?.robotsText ?? null;
    const robots =
      cachedRobotsText !== null
        ? parseRobots(source.rootUrl, cachedRobotsText)
        : await fetchRobots(source.rootUrl);
    if (!isRobotsAllowed(robots, page.url)) {
      await db
        .update(crawledPages)
        .set({
          status: "blocked",
          metadata: mergeCrawledPageMetadata({
            error: "Blocked by robots.txt",
          }),
          updatedAt: new Date(),
        })
        .where(eq(crawledPages.id, crawledPageId));
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

export async function finalizeCrawlSource(
  crawlSourceId: string,
): Promise<void> {
  // Atomic check-and-update: only finalize if no pages are still in progress.
  // This prevents the race where two concurrent workers both see zero remaining
  // and both attempt to finalize, or worse, both skip finalization.
  const statusCounts = await db
    .select({
      status: crawledPages.status,
      count: sql<number>`count(*)`,
    })
    .from(crawledPages)
    .where(eq(crawledPages.crawlSourceId, crawlSourceId))
    .groupBy(crawledPages.status);

  const counts = Object.fromEntries(
    statusCounts.map((r) => [r.status, Number(r.count)]),
  );

  const pendingCount = (counts["pending"] ?? 0) + (counts["processing"] ?? 0);
  if (pendingCount > 0) return;

  const completedCount = (counts["completed"] ?? 0) + (counts["skipped"] ?? 0);
  const failedCount = (counts["failed"] ?? 0) + (counts["blocked"] ?? 0);

  // Use atomic UPDATE with NOT EXISTS to prevent race conditions:
  // only the last worker to finish will successfully update.
  await db.execute(sql`
    UPDATE crawl_sources
    SET status = 'completed',
        last_crawled_at = NOW(),
        metadata = COALESCE(metadata, '{}'::jsonb) || ${JSON.stringify({ pageCount: completedCount, errorCount: failedCount })}::jsonb,
        updated_at = NOW()
    WHERE id = ${crawlSourceId}
      AND status = 'crawling'
      AND NOT EXISTS (
        SELECT 1 FROM crawled_pages
        WHERE crawl_source_id = ${crawlSourceId}
          AND status IN ('pending', 'processing')
      )
  `);
}
