import { sql } from "drizzle-orm";
import {
  crawledPages,
  crawlSources,
  type CrawledPageMetadata,
  type CrawlSourceMetadata,
} from "@teachanything/db/schema";

export function mergeCrawlSourceMetadata(metadata: CrawlSourceMetadata) {
  return sql`COALESCE(${crawlSources.metadata}, '{}'::jsonb) || ${JSON.stringify(metadata)}::jsonb`;
}

export function mergeCrawledPageMetadata(metadata: CrawledPageMetadata) {
  return sql`COALESCE(${crawledPages.metadata}, '{}'::jsonb) || ${JSON.stringify(metadata)}::jsonb`;
}
