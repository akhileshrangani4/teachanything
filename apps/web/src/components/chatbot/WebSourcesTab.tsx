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
import {
  getSourceDisplayName,
  getSourcePageCount,
} from "@/lib/crawler-metadata";
import { WebSourceTable } from "./web-sources/WebSourceTable";
import { AttachExistingSources } from "./web-sources/AttachExistingSources";
import {
  AddFullWebSourceDialog,
  EmptyWebSourcesState,
  SingleWebpageForm,
  WebSourcesSkeleton,
} from "./web-sources/WebSourceForms";
import {
  getFriendlyError,
  hasActiveCrawl,
  normalizeUrl,
  parsePatternList,
} from "./web-sources/utils";

const ITEMS_PER_PAGE = 10;

interface WebSourcesTabProps {
  chatbotId: string;
}

export function WebSourcesTab({ chatbotId }: WebSourcesTabProps) {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [rootUrl, setRootUrl] = useState("");
  const [crawlDepth, setCrawlDepth] = useState(3);
  const [maxPages, setMaxPages] = useState(100);
  const [includePatterns, setIncludePatterns] = useState("");
  const [excludePatterns, setExcludePatterns] = useState("");
  const [manualUrl, setManualUrl] = useState("");
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

  const attach = trpc.crawler.attachToChatbot.useMutation({
    onSuccess: () => {
      refetchSources();
      utils.crawler.getAttachableSources.invalidate();
      toast.success("Web source attached");
    },
    onError: (error) => {
      toast.error("Failed to attach", { description: getFriendlyError(error) });
    },
  });

  const detach = trpc.crawler.detachFromChatbot.useMutation({
    onSuccess: () => {
      refetchSources();
      utils.crawler.getAttachableSources.invalidate();
      toast.success("Removed from this chatbot");
    },
    onError: (error) => {
      toast.error("Failed to remove", { description: getFriendlyError(error) });
    },
  });

  const unattached = (attachable ?? []).filter((s) => !s.isAttached);

  const addCrawlSource = trpc.crawler.addCrawlSource.useMutation({
    onSuccess: () => {
      refetchSources();
      setAddDialogOpen(false);
      setRootUrl("");
      setCrawlDepth(3);
      setMaxPages(100);
      setIncludePatterns("");
      setExcludePatterns("");
      toast.success("Crawl started");
    },
    onError: (error) => {
      toast.error("Failed to start crawl", {
        description: getFriendlyError(error),
      });
    },
  });

  const addManualUrl = trpc.crawler.addManualUrl.useMutation({
    onSuccess: () => {
      refetchSources();
      setManualUrl("");
      toast.success("URL added");
    },
    onError: (error) => {
      toast.error("Failed to add URL", {
        description: getFriendlyError(error),
      });
    },
  });

  const recrawl = trpc.crawler.recrawl.useMutation({
    onSuccess: () => {
      refetchSources();
      toast.success("Re-crawl started");
    },
    onError: (error) => {
      toast.error("Failed to start re-crawl", {
        description: getFriendlyError(error),
      });
    },
  });

  const toggleCrawlSource = trpc.crawler.toggleCrawlSource.useMutation({
    onSuccess: (_data, variables) => {
      refetchSources();
      toast.success(variables.enabled ? "Source enabled" : "Source disabled");
    },
    onError: (error) => {
      toast.error("Failed to toggle source", {
        description: getFriendlyError(error),
      });
    },
  });

  const renameCrawlSource = trpc.crawler.renameCrawlSource.useMutation({
    onSuccess: async () => {
      await Promise.all([
        refetchSources(),
        utils.crawler.getAllCrawlSources.invalidate(),
      ]);
      toast.success("Web source renamed");
    },
    onError: (error) => {
      toast.error("Failed to rename source", {
        description: getFriendlyError(error),
      });
    },
  });

  const handleAddSource = () => {
    addCrawlSource.mutate({
      chatbotId,
      rootUrl: normalizeUrl(rootUrl),
      crawlDepth,
      maxPages,
      includePatterns: parsePatternList(includePatterns),
      excludePatterns: parsePatternList(excludePatterns),
    });
  };

  const handleAddManualUrl = () => {
    if (!manualUrl) return;
    addManualUrl.mutate({ chatbotId, url: normalizeUrl(manualUrl) });
  };

  const toggleExpanded = (sourceId: string) => {
    setExpandedSources((prev) => {
      const next = new Set(prev);
      if (next.has(sourceId)) {
        next.delete(sourceId);
      } else {
        next.add(sourceId);
      }
      return next;
    });
  };

  const handleToggleSelect = (sourceId: string) => {
    setSelectedSources((prev) => {
      const next = new Set(prev);
      if (next.has(sourceId)) {
        next.delete(sourceId);
      } else {
        next.add(sourceId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (pagedSources.length === 0) return;
    const allPagedSelected = pagedSources.every((s) =>
      selectedSources.has(s.id),
    );
    setSelectedSources((prev) => {
      const next = new Set(prev);
      if (allPagedSelected) {
        for (const s of pagedSources) next.delete(s.id);
      } else {
        for (const s of pagedSources) next.add(s.id);
      }
      return next;
    });
  };

  const handleRemoveSelected = async () => {
    const ids = Array.from(selectedSources);
    for (const crawlSourceId of ids) {
      try {
        await detach.mutateAsync({ crawlSourceId, chatbotId });
      } catch (error) {
        console.error(`Failed to remove source ${crawlSourceId}:`, error);
      }
    }
    setSelectedSources(new Set());
    toast.success(
      `${ids.length} web source${ids.length !== 1 ? "s" : ""} removed from chatbot`,
    );
  };

  const allPagedSelected =
    pagedSources.length > 0 &&
    pagedSources.every((s) => selectedSources.has(s.id));

  const isEmpty = allSources.length === 0;
  const isSearchingEmpty = !state.search && !searchInput;

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
            onSubmit={handleAddSource}
            isSubmitting={addCrawlSource.isPending}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <SingleWebpageForm
          manualUrl={manualUrl}
          isSubmitting={addManualUrl.isPending}
          onManualUrlChange={setManualUrl}
          onSubmit={handleAddManualUrl}
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
        ) : isEmpty && isSearchingEmpty ? (
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
