import { userFiles } from "@teachanything/db/schema";
import { like, not } from "drizzle-orm";

/**
 * `userFiles` holds two different kinds of row and `storagePath` is the only
 * thing separating them:
 *
 * - an uploaded file stores a Supabase Storage object key, always the lowercase
 *   `{userId}/{fileId}`
 * - a crawled page stores the page URL (see `crawl-processor.ts`)
 *
 * Every query over `userFiles` therefore has to decide, explicitly, whether
 * crawled pages belong in it. They usually do not: the Files tab renders them
 * as grouped "Web Sources" rows from `crawler.getCrawlSources`, they are
 * recovered by `sweepStaleCrawls` rather than by the upload pipeline, and
 * `files.retry` would try to download their URL out of object storage.
 *
 * Shared from one module so the SQL predicate and the in-process check can't
 * drift apart, and so a new `userFiles` query has an obvious thing to reach for.
 */

/**
 * True for a `userFiles` row that came from the crawler.
 *
 * Case-sensitive on purpose, matching `excludeCrawledPages`: upload paths are
 * always lowercase `{userId}/{fileId}` and crawl URLs are normalized to a
 * lowercase scheme, so there is no casing to be tolerant of.
 */
export function isCrawledPagePath(
  storagePath: string | null | undefined,
): boolean {
  return typeof storagePath === "string" && storagePath.startsWith("http");
}

/**
 * The SQL form of `isCrawledPagePath`, negated for use in a `where`.
 *
 * A case-sensitive `LIKE` is both sufficient (see above) and index-friendlier
 * than `ILIKE`.
 */
export const excludeCrawledPages = not(like(userFiles.storagePath, "http%"));
