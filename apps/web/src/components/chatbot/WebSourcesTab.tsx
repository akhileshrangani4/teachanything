"use client";

import { useState } from "react";
import { Globe } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CrawlSourceCard } from "./web-sources/CrawlSourceCard";
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

  const removeCrawlSource = trpc.crawler.removeCrawlSource.useMutation({
    onSuccess: () => {
      refetchSources();
      toast.success("Web source removed");
    },
    onError: (error) => {
      toast.error("Failed to remove source", {
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

        {sourcesLoading ? (
          <WebSourcesSkeleton />
        ) : !sources || sources.length === 0 ? (
          <EmptyWebSourcesState />
        ) : (
          <div className="space-y-3">
            {sources.map((source) => (
              <CrawlSourceCard
                key={source.id}
                source={source}
                isExpanded={expandedSources.has(source.id)}
                onToggleExpand={() => toggleExpanded(source.id)}
                onRecrawl={() => recrawl.mutate({ crawlSourceId: source.id })}
                onRemove={() =>
                  removeCrawlSource.mutate({ crawlSourceId: source.id })
                }
                onToggleEnabled={(enabled) =>
                  toggleCrawlSource.mutate({
                    crawlSourceId: source.id,
                    enabled,
                  })
                }
                onRename={(name) =>
                  renameCrawlSource.mutateAsync({
                    crawlSourceId: source.id,
                    name,
                  })
                }
                isRecrawling={recrawl.isPending}
                isRemoving={removeCrawlSource.isPending}
                isTogglingEnabled={toggleCrawlSource.isPending}
                isRenaming={renameCrawlSource.isPending}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
