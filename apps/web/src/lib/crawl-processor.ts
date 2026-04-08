import { db } from "@teachanything/db";
import {
  crawlSources,
  crawledPages,
  userFiles,
  fileChunks,
  chatbotFileAssociations,
  chatbots,
} from "@teachanything/db/schema";
import { eq, and, inArray, sql } from "drizzle-orm";
import {
  discoverPages,
  fetchRobots,
  isRobotsAllowed,
  isUrlSafe,
} from "@teachanything/ai/crawler";
import { env } from "./env";
import { publishQStashJob } from "./qstash";
import { logInfo, logError } from "./logger";

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

    await db
      .update(crawlSources)
      .set({ status: "discovering", updatedAt: new Date() })
      .where(eq(crawlSources.id, crawlSourceId));

    const DISCOVERY_TIMEOUT_MS = 5 * 60 * 1000;
    const discovered = await Promise.race([
      discoverPages({
        rootUrl: source.rootUrl,
        maxDepth: source.crawlDepth,
        maxPages: source.maxPages,
        includePatterns: source.includePatterns ?? [],
        excludePatterns: source.excludePatterns ?? [],
      }),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("Discovery timed out after 5 minutes")),
          DISCOVERY_TIMEOUT_MS,
        ),
      ),
    ]);

    if (discovered.length === 0) {
      await db
        .update(crawlSources)
        .set({
          status: "failed",
          metadata: {
            pageCount: 0,
            errorCount: 1,
            errors: [
              {
                url: source.rootUrl,
                error:
                  "No pages could be scraped. The site may require JavaScript to render content.",
              },
            ],
          },
          updatedAt: new Date(),
        })
        .where(eq(crawlSources.id, crawlSourceId));
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

    const pageRecords = [];
    for (const page of discovered) {
      const existing = existingPageMap.get(page.url);
      if (existing) {
        await db
          .update(crawledPages)
          .set({
            status: "pending",
            depth: page.depth,
            updatedAt: new Date(),
          })
          .where(eq(crawledPages.id, existing.id));
        pageRecords.push({ id: existing.id, url: page.url });
      } else {
        const [record] = await db
          .insert(crawledPages)
          .values({
            crawlSourceId,
            url: page.url,
            depth: page.depth,
            status: "pending",
          })
          .onConflictDoUpdate({
            target: [crawledPages.crawlSourceId, crawledPages.url],
            set: {
              status: "pending" as const,
              depth: page.depth,
              updatedAt: new Date(),
            },
          })
          .returning();
        if (record) pageRecords.push({ id: record.id, url: page.url });
      }
    }

    await db
      .update(crawlSources)
      .set({
        status: "crawling",
        metadata: { pageCount: pageRecords.length, errorCount: 0, errors: [] },
        updatedAt: new Date(),
      })
      .where(eq(crawlSources.id, crawlSourceId));

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
    logError(error, "Crawl discovery failed", { crawlSourceId });
    await db
      .update(crawlSources)
      .set({
        status: "failed",
        metadata: {
          errors: [{ url: "discovery", error: getFriendlyErrorMessage(error) }],
        },
        updatedAt: new Date(),
      })
      .where(eq(crawlSources.id, crawlSourceId));
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

    if (!page) return;

    const [source] = await db
      .select()
      .from(crawlSources)
      .where(eq(crawlSources.id, page.crawlSourceId))
      .limit(1);

    if (!source) return;

    const [chatbot] = await db
      .select()
      .from(chatbots)
      .where(eq(chatbots.id, source.chatbotId))
      .limit(1);

    if (!chatbot) return;

    if (!isUrlSafe(page.url)) {
      await db
        .update(crawledPages)
        .set({
          status: "blocked",
          metadata: { error: "URL targets a private or disallowed address" },
          updatedAt: new Date(),
        })
        .where(eq(crawledPages.id, crawledPageId));
      return;
    }

    const robots = await fetchRobots(source.rootUrl);
    if (!isRobotsAllowed(robots, page.url)) {
      await db
        .update(crawledPages)
        .set({
          status: "blocked",
          metadata: { error: "Blocked by robots.txt" },
          updatedAt: new Date(),
        })
        .where(eq(crawledPages.id, crawledPageId));
      return;
    }

    await db
      .update(crawledPages)
      .set({ status: "processing", updatedAt: new Date() })
      .where(eq(crawledPages.id, crawledPageId));

    const { fetchAndExtractPage } = await import("@teachanything/ai/crawler");
    const pageContent = await fetchAndExtractPage(page.url);

    if (!pageContent) {
      await db
        .update(crawledPages)
        .set({
          status: "failed",
          metadata: { error: "Failed to fetch or extract content" },
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

    if (page.userFileId) {
      await db.delete(fileChunks).where(eq(fileChunks.fileId, page.userFileId));
      await db
        .update(userFiles)
        .set({
          fileName: pageContent.title || page.url,
          fileSize: Buffer.byteLength(pageContent.content, "utf-8"),
          processingStatus: "processing",
        })
        .where(eq(userFiles.id, page.userFileId));
    }

    let userFileId = page.userFileId;
    if (!userFileId) {
      const [file] = await db
        .insert(userFiles)
        .values({
          userId: chatbot.userId,
          fileName: pageContent.title || page.url,
          fileType: "text/html",
          fileSize: Buffer.byteLength(pageContent.content, "utf-8"),
          storagePath: page.url,
          processingStatus: "processing",
        })
        .returning();

      userFileId = file!.id;

      await db.insert(chatbotFileAssociations).values({
        chatbotId: source.chatbotId,
        fileId: userFileId,
      });

      await db
        .update(crawledPages)
        .set({ userFileId })
        .where(eq(crawledPages.id, crawledPageId));
    }

    const { createRAGService, createOpenRouterClient } =
      await import("@teachanything/ai");
    const ragService = createRAGService();
    const chunks = await ragService.chunkText(pageContent.content);

    const openrouterClient = createOpenRouterClient(
      env.OPENROUTER_API_KEY,
      env.OPENAI_API_KEY,
    );

    const EMBED_BATCH_SIZE = 50;
    const embeddings: number[][] = [];

    for (let i = 0; i < chunks.length; i += EMBED_BATCH_SIZE) {
      const batch = chunks.slice(
        i,
        Math.min(i + EMBED_BATCH_SIZE, chunks.length),
      );
      const batchEmbeddings = await ragService.generateEmbeddingsForChunks(
        batch,
        openrouterClient,
      );
      embeddings.push(...batchEmbeddings);
    }

    const chunkRecords = await Promise.all(
      chunks.map(async (chunk, index) => ({
        fileId: userFileId!,
        chunkIndex: index,
        content: chunk,
        embedding: embeddings[index]!,
        tokenCount: await ragService.countTokens(chunk),
      })),
    );

    if (chunkRecords.length > 0) {
      await db.insert(fileChunks).values(chunkRecords);
    }

    await db
      .update(userFiles)
      .set({
        processingStatus: "completed",
        metadata: {
          chunkCount: chunks.length,
          processedAt: new Date().toISOString(),
        },
      })
      .where(eq(userFiles.id, userFileId!));

    await db
      .update(crawledPages)
      .set({
        status: "completed",
        title: pageContent.title,
        contentHash: pageContent.contentHash,
        metadata: {
          statusCode: pageContent.statusCode,
          contentType: pageContent.contentType,
          wordCount: pageContent.wordCount,
        },
        updatedAt: new Date(),
      })
      .where(eq(crawledPages.id, crawledPageId));

    logInfo("Crawled page processed", {
      crawledPageId,
      url: page.url,
      chunkCount: chunks.length,
    });
  } catch (error) {
    logError(error, "Crawl page processing failed", { crawledPageId });
    await db
      .update(crawledPages)
      .set({
        status: "failed",
        metadata: {
          error: getFriendlyErrorMessage(error),
        },
        updatedAt: new Date(),
      })
      .where(eq(crawledPages.id, crawledPageId));
  }
}

export async function finalizeCrawlSource(
  crawlSourceId: string,
): Promise<void> {
  const [inProgressResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(crawledPages)
    .where(
      and(
        eq(crawledPages.crawlSourceId, crawlSourceId),
        inArray(crawledPages.status, ["pending", "processing"]),
      ),
    );

  if (Number(inProgressResult?.count ?? 0) > 0) return;

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

  const completedCount = (counts["completed"] ?? 0) + (counts["skipped"] ?? 0);
  const failedCount = (counts["failed"] ?? 0) + (counts["blocked"] ?? 0);

  await db
    .update(crawlSources)
    .set({
      status: "completed",
      lastCrawledAt: new Date(),
      metadata: {
        pageCount: completedCount,
        errorCount: failedCount,
      },
      updatedAt: new Date(),
    })
    .where(eq(crawlSources.id, crawlSourceId));
}
