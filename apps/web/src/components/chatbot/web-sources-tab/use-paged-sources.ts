"use client";

import { useEffect, useMemo } from "react";
import type { RouterOutputs } from "@/lib/trpc";
import type { WebSourceSortBy } from "@/components/data-table";
import type { SortDirection } from "@/hooks/useServerTable";
import {
  getSourceDisplayName,
  getSourcePageCount,
} from "@/lib/crawler-metadata";

type CrawlSource = RouterOutputs["crawler"]["getCrawlSources"][number];

/**
 * Client-side search + sort + pagination over the full crawl-source list
 * (source counts are small, so the existing array query is reused rather
 * than paginating server-side).
 */
export function usePagedSources({
  sources,
  search,
  sortBy,
  sortDir,
  page,
  pageSize,
  setPage,
}: {
  sources: CrawlSource[];
  search: string;
  sortBy: WebSourceSortBy;
  sortDir: SortDirection;
  page: number;
  pageSize: number;
  setPage: (page: number) => void;
}): {
  totalCount: number;
  totalPages: number;
  pagedSources: CrawlSource[];
} {
  const filteredSources = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return sources;
    return sources.filter((s) => {
      const name = getSourceDisplayName(s).toLowerCase();
      return name.includes(term) || s.rootUrl.toLowerCase().includes(term);
    });
  }, [sources, search]);

  const sortedSources = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    const compare = (
      a: (typeof filteredSources)[number],
      b: (typeof filteredSources)[number],
    ): number => {
      switch (sortBy) {
        case "name":
          return (
            getSourceDisplayName(a).localeCompare(getSourceDisplayName(b)) * dir
          );
        case "pageCount":
          return (getSourcePageCount(a) - getSourcePageCount(b)) * dir;
        case "status":
          return a.status.localeCompare(b.status) * dir;
        case "lastCrawledAt": {
          const at = a.lastCrawledAt ? new Date(a.lastCrawledAt).getTime() : 0;
          const bt = b.lastCrawledAt ? new Date(b.lastCrawledAt).getTime() : 0;
          return (at - bt) * dir;
        }
        case "createdAt":
        default: {
          const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return (at - bt) * dir;
        }
      }
    };
    return [...filteredSources].sort(compare);
  }, [filteredSources, sortBy, sortDir]);

  const totalCount = sortedSources.length;
  const totalPages = Math.ceil(totalCount / pageSize);
  const pagedSources = useMemo(
    () => sortedSources.slice(page * pageSize, page * pageSize + pageSize),
    [sortedSources, page, pageSize],
  );

  // Clamp page if the current page no longer exists (e.g. after removal).
  useEffect(() => {
    if (page >= totalPages && totalPages > 0) {
      setPage(totalPages - 1);
    }
  }, [page, totalPages, setPage]);

  return { totalCount, totalPages, pagedSources };
}
