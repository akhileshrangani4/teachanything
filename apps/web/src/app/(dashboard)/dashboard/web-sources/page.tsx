"use client";

import { Loader2 } from "lucide-react";
import { FileTableSkeleton } from "@/components/ui/skeletons";
import { AddWebSourcePanel } from "@/components/dashboard/web-sources/AddWebSourcePanel";
import { useWebSourcesPage } from "./use-web-sources-page";
import { WebSourcesEmptyState } from "./web-sources-empty-state";
import { WebSourcesList } from "./web-sources-list";
import {
  CRAWL_SOURCES_PER_HOUR,
  MANUAL_URLS_PER_HOUR,
} from "@/lib/constants/rate-limits";

export default function WebSourcesPage() {
  const page = useWebSourcesPage();
  const {
    state,
    searchInput,
    actions,
    sources,
    chatbots,
    totalCount,
    totalPages,
    selectedSources,
    expandedSources,
    mutations: {
      attach,
      detach,
      recrawl,
      cancelCrawlSource,
      toggleCrawlSource,
      renameCrawlSource,
      removeCrawlSource,
    },
    hasChatbots,
    hasSources,
    isFiltering,
    showFullLoading,
    showInlineLoading,
    allPageSelected,
  } = page;

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
              {page.data && (
                <span className="ml-2 font-medium text-foreground">
                  ({totalCount} {totalCount === 1 ? "source" : "sources"})
                </span>
              )}
              {showInlineLoading && (
                <Loader2 className="ml-2 inline h-4 w-4 animate-spin align-[-2px] text-muted-foreground" />
              )}
            </p>
            <p className="text-muted-foreground mt-2 text-sm">
              You can add up to {CRAWL_SOURCES_PER_HOUR} full website crawls and{" "}
              {MANUAL_URLS_PER_HOUR} single webpages per hour. These are hourly
              limits, not a cap on how many web sources you can have in total.
            </p>
            <p className="text-muted-foreground mt-2 text-sm">
              You can add up to {CRAWL_SOURCES_PER_HOUR} full website crawls and{" "}
              {MANUAL_URLS_PER_HOUR} single webpages per hour. These are hourly
              limits, not a cap on how many web sources you can have in total.
            </p>
          </div>
          <AddWebSourcePanel />
        </div>

        {showFullLoading ? (
          <FileTableSkeleton />
        ) : !hasSources && !isFiltering ? (
          <WebSourcesEmptyState hasChatbots={hasChatbots} />
        ) : (
          <WebSourcesList
            searchValue={searchInput}
            onSearchChange={actions.setSearch}
            statusFilter={page.statusFilter}
            onStatusChange={page.handleStatusChange}
            showInlineLoading={showInlineLoading}
            sources={sources}
            chatbots={chatbots}
            totalCount={totalCount}
            totalPages={totalPages}
            currentPage={state.page}
            onPageChange={actions.setPage}
            selectedSources={selectedSources}
            expandedSources={expandedSources}
            allSelected={allPageSelected}
            deletePending={removeCrawlSource.isPending}
            onDeleteSelected={page.handleDeleteSelected}
            onToggleSelect={page.toggleSelect}
            onSelectAll={page.handleSelectAll}
            onToggleExpand={page.toggleExpand}
            onAttach={(crawlSourceId, chatbotId) =>
              attach.mutate({ crawlSourceId, chatbotId })
            }
            onDetach={(crawlSourceId, chatbotId) =>
              detach.mutate({ crawlSourceId, chatbotId })
            }
            isAttaching={attach.isPending || detach.isPending}
            onRecrawl={(crawlSourceId) => recrawl.mutate({ crawlSourceId })}
            onDelete={(crawlSourceId) =>
              removeCrawlSource.mutate({ crawlSourceId })
            }
            onStop={(crawlSourceId) =>
              cancelCrawlSource.mutate({ crawlSourceId })
            }
            onToggleEnabled={(crawlSourceId, enabled) =>
              toggleCrawlSource.mutate({ crawlSourceId, enabled })
            }
            onRename={(crawlSourceId, name) =>
              renameCrawlSource.mutateAsync({ crawlSourceId, name })
            }
            isRecrawling={recrawl.isPending}
            isDeleting={removeCrawlSource.isPending}
            isStopping={cancelCrawlSource.isPending}
            isTogglingEnabled={toggleCrawlSource.isPending}
            isRenaming={renameCrawlSource.isPending}
            sortBy={state.sortBy}
            sortDir={state.sortDir}
            onSort={actions.toggleSort}
          />
        )}
      </div>
    </div>
  );
}
