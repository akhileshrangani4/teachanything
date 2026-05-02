import type {
  CrawledPageMetadata,
  CrawlSourceMetadata,
} from "@teachanything/db/schema";

export type { CrawledPageMetadata, CrawlSourceMetadata };

export function getSourceDisplayName(source: {
  rootUrl: string;
  metadata: CrawlSourceMetadata | null;
}): string {
  return source.metadata?.displayName?.trim() || source.rootUrl;
}

export function getSourcePageCount(source: {
  metadata: CrawlSourceMetadata | null;
}): number {
  return typeof source.metadata?.pageCount === "number"
    ? source.metadata.pageCount
    : 0;
}

export function getSourceErrorCount(source: {
  metadata: CrawlSourceMetadata | null;
}): number {
  return typeof source.metadata?.errorCount === "number"
    ? source.metadata.errorCount
    : 0;
}

export function getPageDisplayTitle(page: {
  title: string | null;
  url: string;
  metadata?: CrawledPageMetadata | null;
}): string {
  return page.metadata?.customTitle?.trim() || page.title || page.url;
}
