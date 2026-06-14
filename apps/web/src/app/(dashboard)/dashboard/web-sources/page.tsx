"use client";

import Link from "next/link";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { FileTableSkeleton } from "@/components/ui/skeletons";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PaginationControls } from "@/components/dashboard/files/PaginationControls";
import { TableToolbar } from "@/components/data-table";
import { useServerTable } from "@/hooks/useServerTable";
import { Globe, Loader2, X } from "lucide-react";
import { keepPreviousData } from "@tanstack/react-query";
import { toast } from "sonner";
import { AddWebSourcePanel } from "@/components/dashboard/web-sources/AddWebSourcePanel";
import {
  DashboardWebSourceTable,
  type DashboardSortBy,
} from "@/components/dashboard/web-sources/DashboardWebSourceTable";
import { hasActiveCrawl } from "@/components/chatbot/web-sources/utils";

const ITEMS_PER_PAGE = 20;

type StatusFilter = "all" | "crawling" | "completed" | "failed" | "disabled";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "crawling", label: "Crawling" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
  { value: "disabled", label: "Disabled" },
];

export default function WebSourcesPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedSources, setSelectedSources] = useState<Set<string>>(
    new Set(),
  );
  const [expandedSources, setExpandedSources] = useState<Set<string>>(
    new Set(),
  );

  const { state, searchInput, actions } = useServerTable<DashboardSortBy>(
    { defaultSortBy: "createdAt", defaultSortDir: "desc" },
    ITEMS_PER_PAGE,
  );

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

  const attach = trpc.crawler.attachToChatbot.useMutation({
    onSuccess: () => refreshSources(),
    onError: (e) => toast.error("Failed to attach", { description: e.message }),
  });
  const detach = trpc.crawler.detachFromChatbot.useMutation({
    onSuccess: () => refreshSources(),
    onError: (e) => toast.error("Failed to remove", { description: e.message }),
  });
  const recrawl = trpc.crawler.recrawl.useMutation({
    onSuccess: () => {
      refreshSources();
      toast.success("Re-crawl started");
    },
    onError: (e) =>
      toast.error("Failed to start re-crawl", { description: e.message }),
  });
  const toggleCrawlSource = trpc.crawler.toggleCrawlSource.useMutation({
    onSuccess: (_data, variables) => {
      refreshSources();
      toast.success(variables.enabled ? "Source enabled" : "Source disabled");
    },
    onError: (e) =>
      toast.error("Failed to toggle source", { description: e.message }),
  });
  const renameCrawlSource = trpc.crawler.renameCrawlSource.useMutation({
    onSuccess: () => {
      refreshSources();
      toast.success("Web source renamed");
    },
    onError: (e) =>
      toast.error("Failed to rename source", { description: e.message }),
  });
  const removeCrawlSource = trpc.crawler.removeCrawlSource.useMutation({
    onSuccess: () => {
      refreshSources();
      toast.success("Web source deleted");
    },
    onError: (e) =>
      toast.error("Failed to delete source", { description: e.message }),
  });

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
    setSelectedSources((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleExpand = (id: string) => {
    setExpandedSources((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allPageSelected =
    sources.length > 0 && sources.every((s) => selectedSources.has(s.id));

  const handleSelectAll = () => {
    if (sources.length === 0) return;
    setSelectedSources((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        for (const s of sources) next.delete(s.id);
      } else {
        for (const s of sources) next.add(s.id);
      }
      return next;
    });
  };

  const handleDeleteSelected = async () => {
    const ids = Array.from(selectedSources);
    let failures = 0;
    for (const crawlSourceId of ids) {
      try {
        await removeCrawlSource.mutateAsync({ crawlSourceId });
      } catch {
        failures++;
      }
    }
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

  return (
    <div className="flex-1 p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-4xl font-bold text-foreground tracking-tight">
              Web Sources
            </h1>
            <p className="text-muted-foreground mt-2 text-lg">
              Crawl full websites or add single webpages, then attach them to
              your chatbots.
              {data && (
                <span className="ml-2 font-medium text-foreground">
                  ({totalCount} {totalCount === 1 ? "source" : "sources"})
                </span>
              )}
              {showInlineLoading && (
                <Loader2 className="ml-2 inline h-4 w-4 animate-spin align-[-2px] text-muted-foreground" />
              )}
            </p>
          </div>
          <AddWebSourcePanel />
        </div>

        {showFullLoading ? (
          <FileTableSkeleton />
        ) : !hasSources && !isFiltering ? (
          <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
            <Globe className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium text-foreground">
              No web sources yet
            </p>
            <p className="text-sm mt-1 max-w-xl mx-auto">
              Use{" "}
              <span className="font-medium text-foreground">
                Add single page
              </span>{" "}
              or{" "}
              <span className="font-medium text-foreground">
                Add Full Web Source
              </span>{" "}
              above to get started.
              {!hasChatbots &&
                " You can create a chatbot later and attach sources to it."}
            </p>
            {!hasChatbots && (
              <Button asChild variant="outline" className="mt-5">
                <Link href="/dashboard/chatbots">Create a Chatbot</Link>
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <TableToolbar
                searchValue={searchInput}
                onSearchChange={actions.setSearch}
                placeholder="Search web sources..."
                isLoading={showInlineLoading}
                className="mb-0 flex-1"
              />
              <Select value={statusFilter} onValueChange={handleStatusChange}>
                <SelectTrigger className="sm:w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-4 sm:ml-auto">
                {selectedSources.size > 0 && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={handleDeleteSelected}
                    disabled={removeCrawlSource.isPending}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Delete Selected ({selectedSources.size})
                  </Button>
                )}
                <p className="text-sm text-muted-foreground whitespace-nowrap">
                  Showing {sources.length} of {totalCount} source
                  {totalCount !== 1 ? "s" : ""}
                </p>
              </div>
            </div>

            {sources.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                No web sources match your filters.
              </div>
            ) : (
              <>
                <DashboardWebSourceTable
                  sources={sources}
                  chatbots={chatbots}
                  selectedSources={selectedSources}
                  onToggleSelect={toggleSelect}
                  onSelectAll={handleSelectAll}
                  allSelected={allPageSelected}
                  expandedSources={expandedSources}
                  onToggleExpand={toggleExpand}
                  onAttach={(crawlSourceId, chatbotId) =>
                    attach.mutate({ crawlSourceId, chatbotId })
                  }
                  onDetach={(crawlSourceId, chatbotId) =>
                    detach.mutate({ crawlSourceId, chatbotId })
                  }
                  isAttaching={attach.isPending || detach.isPending}
                  onRecrawl={(crawlSourceId) =>
                    recrawl.mutate({ crawlSourceId })
                  }
                  onDelete={(crawlSourceId) =>
                    removeCrawlSource.mutate({ crawlSourceId })
                  }
                  onToggleEnabled={(crawlSourceId, enabled) =>
                    toggleCrawlSource.mutate({ crawlSourceId, enabled })
                  }
                  onRename={(crawlSourceId, name) =>
                    renameCrawlSource.mutateAsync({ crawlSourceId, name })
                  }
                  isRecrawling={recrawl.isPending}
                  isDeleting={removeCrawlSource.isPending}
                  isTogglingEnabled={toggleCrawlSource.isPending}
                  isRenaming={renameCrawlSource.isPending}
                  sortBy={state.sortBy}
                  sortDir={state.sortDir}
                  onSort={actions.toggleSort}
                />
                {totalPages > 1 && (
                  <PaginationControls
                    currentPage={state.page}
                    totalPages={totalPages}
                    onPageChange={actions.setPage}
                  />
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
