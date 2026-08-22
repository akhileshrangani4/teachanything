import { db } from "@teachanything/db";
import { crawlSources, crawledPages } from "@teachanything/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { discoverPages, fetchRobotsText } from "@teachanything/ai/crawler";
import { env } from "@/lib/env";
import { publishQStashJob } from "../qstash";
import { logInfo, logError } from "@/lib/logger";
import { mergeCrawlSourceMetadata } from "../crawler-metadata-sql";
import { CrawlNoLongerRunningError, getFriendlyErrorMessage } from "./errors";
import { processCrawlPage } from "./content-pipeline";
import { finalizeCrawlSource } from "./finalize";

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
