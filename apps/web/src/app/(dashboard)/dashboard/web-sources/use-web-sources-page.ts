"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import type { DashboardSortBy } from "@/components/dashboard/web-sources/DashboardWebSourceTable";
import { useServerTable } from "@/hooks/useServerTable";
import { hasActiveCrawl } from "@/components/chatbot/web-sources/utils";
import { useCrawlerMutations } from "@/hooks/use-crawler-mutations";
import { toggleAllInSet, toggleInSet } from "@/lib/selection";
import { runSequentially } from "@/lib/sequential-actions";
import { toast } from "sonner";
import { keepPreviousData } from "@tanstack/react-query";
import type { StatusFilter } from "./status-filter";

const ITEMS_PER_PAGE = 20;

/**
 * Owns all stateful behavior for the web sources dashboard: table state,
 * status filter, crawl-source queries with active-crawl polling, crawler
 * mutations, selection/expand sets, and batch delete (toast copy preserved).
 */
export function useWebSourcesPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedSources, setSelectedSources] = useState<Set<string>>(
    new Set(),
  );
  const [expandedSources, setExpandedSources] = useState<Set<string>>(
    new Set(),
  );

  const table = useServerTable<DashboardSortBy>(
    { defaultSortBy: "createdAt", defaultSortDir: "desc" },
    ITEMS_PER_PAGE,
  );
  const { state, searchInput, actions } = table;

  const { data, isLoading, isFetching } =
    trpc.crawler.getAllCrawlSources.useQuery(
      {
        limit: ITEMS_PER_PAGE,
        offset: state.page * ITEMS_PER_PAGE,
        search: state.search || undefined,
        status: statusFilter,
        sortBy: state.sortBy,
        sortDir: state.sortDir,
      },
      {
        placeholderData: keepPreviousData,
        refetchInterval: (query) =>
          hasActiveCrawl(query.state.data?.sources ?? []) ? 3000 : false,
      },
    );
  const { data: chatbotsData, isLoading: chatbotsLoading } =
    trpc.chatbot.list.useQuery({ limit: 100, offset: 0 });

  const sources = data?.sources ?? [];
  const totalCount = data?.totalCount ?? 0;
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
  const chatbots = chatbotsData?.chatbots ?? [];
  const chatbotCount = chatbotsData?.totalCount ?? 0;

  const utils = trpc.useUtils();
  const refreshSources = () => utils.crawler.getAllCrawlSources.invalidate();

  const mutations = useCrawlerMutations({ refresh: refreshSources });

  const hasChatbots = chatbotCount > 0;
  const hasSources = sources.length > 0;
  const isFiltering = !!state.search || statusFilter !== "all";
  // Full skeleton only on initial load (no data yet); keep the list and show
  // an inline spinner on background refetch / pagination (keepPreviousData).
  const showFullLoading =
    (isLoading && !data) || (chatbotsLoading && !chatbotsData);
  const showInlineLoading = isFetching && !isLoading;

  const handleStatusChange = (value: StatusFilter) => {
    setStatusFilter(value);
    actions.setPage(0);
  };

  const toggleSelect = (id: string) => {
    setSelectedSources((prev) => toggleInSet(prev, id));
  };

  const toggleExpand = (id: string) => {
    setExpandedSources((prev) => toggleInSet(prev, id));
  };

  const allPageSelected =
    sources.length > 0 && sources.every((s) => selectedSources.has(s.id));

  const handleSelectAll = () => {
    if (sources.length === 0) return;
    setSelectedSources((prev) =>
      toggleAllInSet(
        prev,
        sources.map((s) => s.id),
      ),
    );
  };

  const handleDeleteSelected = async () => {
    const ids = Array.from(selectedSources);
    const failures = await runSequentially(
      ids,
      (crawlSourceId) =>
        mutations.removeCrawlSource.mutateAsync({ crawlSourceId }),
      (crawlSourceId) => `Failed to delete source ${crawlSourceId}`,
    );
    setSelectedSources(new Set());
    if (failures === 0) {
      toast.success(
        `${ids.length} web source${ids.length !== 1 ? "s" : ""} deleted`,
      );
    } else {
      toast.warning(
        `Deleted ${ids.length - failures} of ${ids.length}. ${failures} could not be deleted (crawl in progress).`,
      );
    }
  };

  return {
    table,
    state,
    searchInput,
    actions,
    statusFilter,
    handleStatusChange,
    selectedSources,
    expandedSources,
    sources,
    data,
    totalCount,
    totalPages,
    chatbots,
    mutations,
    hasChatbots,
    hasSources,
    isFiltering,
    showFullLoading,
    showInlineLoading,
    allPageSelected,
    toggleSelect,
    toggleExpand,
    handleSelectAll,
    handleDeleteSelected,
  };
}

export type WebSourcesPageController = ReturnType<typeof useWebSourcesPage>;
