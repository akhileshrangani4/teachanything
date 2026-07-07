import type {
  CrawledPageMetadata,
  CrawlSourceMetadata,
} from "@teachanything/db/schema";

export type { CrawledPageMetadata, CrawlSourceMetadata };

// Resolves the label to show for a crawl source: the user-set display name
// when present, otherwise the root URL. Shared by the full source list and
// the attach picker (which only fetches displayName, not full metadata).
export function resolveSourceDisplayName(
  displayName: string | null | undefined,
  rootUrl: string,
): string {
  return displayName?.trim() || rootUrl;
}

export function getSourceDisplayName(source: {
  rootUrl: string;
  metadata: CrawlSourceMetadata | null;
}): string {
  return resolveSourceDisplayName(source.metadata?.displayName, source.rootUrl);
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
