"use client";

import { useEffect, useMemo, useState } from "react";
import { Globe, X } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TableToolbar, type WebSourceSortBy } from "@/components/data-table";
import { PaginationControls } from "@/components/dashboard/files/PaginationControls";
import { useServerTable } from "@/hooks/useServerTable";
import { useAddWebSource } from "@/hooks/use-add-web-source";
import { useCrawlerMutations } from "@/hooks/use-crawler-mutations";
import {
  getSourceDisplayName,
  getSourcePageCount,
} from "@/lib/crawler-metadata";
import { toggleAllInSet, toggleInSet } from "@/lib/selection";
import { runSequentially } from "@/lib/sequential-actions";
import { WebSourceTable } from "./web-sources/WebSourceTable";
import { AttachExistingSources } from "./web-sources/AttachExistingSources";
import {
  AddFullWebSourceDialog,
  EmptyWebSourcesState,
  SingleWebpageForm,
  WebSourcesSkeleton,
} from "./web-sources/WebSourceForms";
import { getFriendlyError, hasActiveCrawl } from "./web-sources/utils";

const ITEMS_PER_PAGE = 10;

interface WebSourcesTabProps {
  chatbotId: string;
}

export function WebSourcesTab({ chatbotId }: WebSourcesTabProps) {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [expandedSources, setExpandedSources] = useState<Set<string>>(
    new Set(),
  );
  const [selectedSources, setSelectedSources] = useState<Set<string>>(
    new Set(),
  );

  const { state, searchInput, actions } = useServerTable<WebSourceSortBy>(
    { defaultSortBy: "createdAt", defaultSortDir: "desc" },
    ITEMS_PER_PAGE,
  );

  const {
    data: sources,
    isLoading: sourcesLoading,
    refetch: refetchSources,
  } = trpc.crawler.getCrawlSources.useQuery(
    { chatbotId },
    {
      refetchInterval: (query) =>
        hasActiveCrawl(query.state.data ?? []) ? 3000 : false,
    },
  );
  const utils = trpc.useUtils();

  const { data: attachable } = trpc.crawler.getAttachableSources.useQuery({
    chatbotId,
  });

  const allSources = useMemo(() => sources ?? [], [sources]);

  // Client-side search + sort + pagination (source counts are small, so
  // the existing array query is reused rather than paginating server-side).
  const filteredSources = useMemo(() => {
    const search = state.search.trim().toLowerCase();
    if (!search) return allSources;
    return allSources.filter((s) => {
      const name = getSourceDisplayName(s).toLowerCase();
      return name.includes(search) || s.rootUrl.toLowerCase().includes(search);
    });
  }, [allSources, state.search]);

  const sortedSources = useMemo(() => {
    const dir = state.sortDir === "asc" ? 1 : -1;
    const compare = (
      a: (typeof filteredSources)[number],
      b: (typeof filteredSources)[number],
    ): number => {
      switch (state.sortBy) {
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
  }, [filteredSources, state.sortBy, state.sortDir]);

  const totalCount = sortedSources.length;
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
  const pagedSources = useMemo(
    () =>
      sortedSources.slice(
        state.page * ITEMS_PER_PAGE,
        state.page * ITEMS_PER_PAGE + ITEMS_PER_PAGE,
      ),
    [sortedSources, state.page],
  );

  // Clamp page if the current page no longer exists (e.g. after removal).
  useEffect(() => {
    if (state.page >= totalPages && totalPages > 0) {
      actions.setPage(totalPages - 1);
    }
  }, [state.page, totalPages, actions]);

  // Drop selections for sources that are no longer present.
  useEffect(() => {
    setSelectedSources((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const id of prev) {
        if (!allSources.some((s) => s.id === id)) {
          next.delete(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [allSources]);

  const {
    rootUrl,
    crawlDepth,
    maxPages,
    includePatterns,
    excludePatterns,
    manualUrl,
    setRootUrl,
    setCrawlDepth,
    setMaxPages,
    setIncludePatterns,
    setExcludePatterns,
    setManualUrl,
    submitCrawlSource,
    submitManualUrl,
    isSubmittingCrawlSource,
    isSubmittingManualUrl,
  } = useAddWebSource({
    chatbotId,
    onAdded: () => {
      void refetchSources();
    },
    onCrawlSourceAdded: () => setAddDialogOpen(false),
  });

  const {
    attach,
    detach,
    recrawl,
    cancelCrawlSource,
    toggleCrawlSource,
    renameCrawlSource,
  } = useCrawlerMutations({
    refresh: refetchSources,
    refreshAttachments: () => utils.crawler.getAttachableSources.invalidate(),
    attachSuccessMessage: "Web source attached",
    detachSuccessMessage: "Removed from this chatbot",
    formatError: getFriendlyError,
    refreshAfterRename: () =>
      Promise.all([
        refetchSources(),
        utils.crawler.getAllCrawlSources.invalidate(),
      ]),
  });

  const unattached = (attachable ?? []).filter((s) => !s.isAttached);

  const toggleExpanded = (sourceId: string) => {
    setExpandedSources((prev) => toggleInSet(prev, sourceId));
  };

  const handleToggleSelect = (sourceId: string) => {
    setSelectedSources((prev) => toggleInSet(prev, sourceId));
  };

  const handleSelectAll = () => {
    if (pagedSources.length === 0) return;
    setSelectedSources((prev) =>
      toggleAllInSet(
        prev,
        pagedSources.map((s) => s.id),
      ),
    );
  };

  const handleRemoveSelected = async () => {
    const ids = Array.from(selectedSources);
    await runSequentially(
      ids,
      (crawlSourceId) => detach.mutateAsync({ crawlSourceId, chatbotId }),
      (crawlSourceId) => `Failed to remove source ${crawlSourceId}`,
    );
    setSelectedSources(new Set());
    toast.success(
      `${ids.length} web source${ids.length !== 1 ? "s" : ""} removed from chatbot`,
    );
  };

  const allPagedSelected =
    pagedSources.length > 0 &&
    pagedSources.every((s) => selectedSources.has(s.id));

  const isEmpty = allSources.length === 0;
  const isNotSearching = !state.search && !searchInput;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Web Sources
            </CardTitle>
            <CardDescription className="mt-1.5">
              Crawl websites to add their content to your chatbot&apos;s
              knowledge base.
            </CardDescription>
          </div>
          <AddFullWebSourceDialog
            open={addDialogOpen}
            onOpenChange={setAddDialogOpen}
            rootUrl={rootUrl}
            crawlDepth={crawlDepth}
            maxPages={maxPages}
            includePatterns={includePatterns}
            excludePatterns={excludePatterns}
            onRootUrlChange={setRootUrl}
            onCrawlDepthChange={setCrawlDepth}
            onMaxPagesChange={setMaxPages}
            onIncludePatternsChange={setIncludePatterns}
            onExcludePatternsChange={setExcludePatterns}
            onSubmit={submitCrawlSource}
            isSubmitting={isSubmittingCrawlSource}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <SingleWebpageForm
          manualUrl={manualUrl}
          isSubmitting={isSubmittingManualUrl}
          onManualUrlChange={setManualUrl}
          onSubmit={submitManualUrl}
        />

        <AttachExistingSources
          sources={unattached}
          onAttach={(crawlSourceId) =>
            attach.mutate({ crawlSourceId, chatbotId })
          }
          attachingId={
            attach.isPending ? (attach.variables?.crawlSourceId ?? null) : null
          }
          isAttaching={attach.isPending}
        />

        {sourcesLoading ? (
          <WebSourcesSkeleton />
        ) : isEmpty && isNotSearching ? (
          <EmptyWebSourcesState />
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-4 mb-4">
              <TableToolbar
                searchValue={searchInput}
                onSearchChange={actions.setSearch}
                placeholder="Search web sources..."
                className="mb-0 flex-1"
              />
              <div className="flex items-center gap-4 ml-auto">
                {selectedSources.size > 0 && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={handleRemoveSelected}
                    disabled={detach.isPending}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Remove Selected ({selectedSources.size})
                  </Button>
                )}
                <p className="text-sm text-muted-foreground whitespace-nowrap">
                  Showing {pagedSources.length} of {totalCount} source
                  {totalCount !== 1 ? "s" : ""}
                </p>
              </div>
            </div>

            {pagedSources.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No web sources match your search
              </div>
            ) : (
              <>
                <WebSourceTable
                  sources={pagedSources}
                  showCheckbox
                  selectedSources={selectedSources}
                  onToggleSelect={handleToggleSelect}
                  onSelectAll={handleSelectAll}
                  allSelected={allPagedSelected}
                  expandedSources={expandedSources}
                  onToggleExpand={toggleExpanded}
                  onRecrawl={(id) => recrawl.mutate({ crawlSourceId: id })}
                  onRemove={(id) =>
                    detach.mutate({ crawlSourceId: id, chatbotId })
                  }
                  onStop={(id) =>
                    cancelCrawlSource.mutate({ crawlSourceId: id })
                  }
                  onToggleEnabled={(id, enabled) =>
                    toggleCrawlSource.mutate({ crawlSourceId: id, enabled })
                  }
                  onRename={(id, name) =>
                    renameCrawlSource.mutateAsync({
                      crawlSourceId: id,
                      name,
                    })
                  }
                  isRecrawling={recrawl.isPending}
                  isRemoving={detach.isPending}
                  isStopping={cancelCrawlSource.isPending}
                  isTogglingEnabled={toggleCrawlSource.isPending}
                  isRenaming={renameCrawlSource.isPending}
                  sortBy={state.sortBy}
                  sortDir={state.sortDir}
                  onSort={actions.toggleSort}
                />
                {totalPages > 1 && (
                  <div className="mt-4">
                    <PaginationControls
                      currentPage={state.page}
                      totalPages={totalPages}
                      onPageChange={actions.setPage}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
