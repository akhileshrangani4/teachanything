"use client";

import { useMemo, useState } from "react";
import { Globe, X } from "lucide-react";
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
import { WebSourceTable } from "./web-sources/WebSourceTable";
import { AttachExistingSources } from "./web-sources/AttachExistingSources";
import {
  AddFullWebSourceDialog,
  EmptyWebSourcesState,
  SingleWebpageForm,
  WebSourcesSkeleton,
} from "./web-sources/WebSourceForms";
import { getFriendlyError, hasActiveCrawl } from "./web-sources/utils";
import { usePagedSources } from "./web-sources-tab/use-paged-sources";
import { useSourceSelection } from "./web-sources-tab/use-source-selection";

const ITEMS_PER_PAGE = 10;

interface WebSourcesTabProps {
  chatbotId: string;
}

export function WebSourcesTab({ chatbotId }: WebSourcesTabProps) {
  const [addDialogOpen, setAddDialogOpen] = useState(false);

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

  const { totalCount, totalPages, pagedSources } = usePagedSources({
    sources: allSources,
    search: state.search,
    sortBy: state.sortBy,
    sortDir: state.sortDir,
    page: state.page,
    pageSize: ITEMS_PER_PAGE,
    setPage: actions.setPage,
  });

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

  const {
    expandedSources,
    selectedSources,
    toggleExpanded,
    handleToggleSelect,
    handleSelectAll,
    handleRemoveSelected,
  } = useSourceSelection({
    allSources,
    pagedSources,
    removeOne: (crawlSourceId) =>
      detach.mutateAsync({ crawlSourceId, chatbotId }),
  });

  const unattached = (attachable ?? []).filter((s) => !s.isAttached);

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
