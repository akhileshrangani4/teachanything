"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Globe,
  Plus,
  RefreshCw,
  Trash2,
  Download,
  ChevronDown,
  ChevronRight,
  Link as LinkIcon,
  Loader2,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  Clock,
  Ban,
  SkipForward,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";

interface WebSourcesTabProps {
  chatbotId: string;
}

function getSourceStatusBadge(status: string) {
  switch (status) {
    case "completed":
      return (
        <Badge className="bg-green-600">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Completed
        </Badge>
      );
    case "crawling":
      return (
        <Badge className="bg-blue-600">
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          Crawling
        </Badge>
      );
    case "discovering":
      return (
        <Badge className="bg-blue-600">
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          Discovering
        </Badge>
      );
    case "pending":
      return (
        <Badge variant="secondary">
          <Clock className="h-3 w-3 mr-1" />
          Pending
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="destructive">
          <AlertCircle className="h-3 w-3 mr-1" />
          Failed
        </Badge>
      );
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

function getPageStatusBadge(status: string) {
  switch (status) {
    case "completed":
      return (
        <Badge variant="outline" className="text-green-600 border-green-600">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Done
        </Badge>
      );
    case "processing":
      return (
        <Badge variant="outline" className="text-blue-600 border-blue-600">
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          Processing
        </Badge>
      );
    case "pending":
      return (
        <Badge variant="outline">
          <Clock className="h-3 w-3 mr-1" />
          Pending
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="outline" className="text-red-600 border-red-600">
          <AlertCircle className="h-3 w-3 mr-1" />
          Failed
        </Badge>
      );
    case "blocked":
      return (
        <Badge variant="outline" className="text-yellow-600 border-yellow-600">
          <Ban className="h-3 w-3 mr-1" />
          Blocked
        </Badge>
      );
    case "skipped":
      return (
        <Badge variant="outline" className="text-gray-500 border-gray-500">
          <SkipForward className="h-3 w-3 mr-1" />
          Unchanged
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function getFriendlyError(error: { message: string }): string {
  try {
    const parsed = JSON.parse(error.message) as Array<{
      code?: string;
      path?: string[];
      message?: string;
      maximum?: number;
      minimum?: number;
    }>;
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed
        .map((e) => {
          const field = e.path?.join(".") ?? "input";
          const code = e.code ?? "";
          if (code === "too_big" && field === "maxPages")
            return `Max pages cannot exceed ${e.maximum}`;
          if (code === "too_small" && field === "maxPages")
            return `Max pages must be at least ${e.minimum}`;
          if (code === "too_big" && field === "crawlDepth")
            return `Crawl depth cannot exceed ${e.maximum}`;
          if (code === "too_small" && field === "crawlDepth")
            return `Crawl depth must be at least ${e.minimum}`;
          if (field === "rootUrl" || field === "url")
            return "Please enter a valid URL";
          return e.message ?? "Invalid input";
        })
        .join(". ");
    }
  } catch {
    // not JSON
  }
  return error.message;
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

  const hasActiveCrawl = (sources: Array<{ status: string }>) =>
    sources?.some(
      (s) =>
        s.status === "pending" ||
        s.status === "discovering" ||
        s.status === "crawling",
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

  const addManualUrlMutation = trpc.crawler.addManualUrl.useMutation({
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

  const normalizeUrl = (url: string) => {
    const trimmed = url.trim();
    if (trimmed && !trimmed.match(/^https?:\/\//i)) {
      return `https://${trimmed}`;
    }
    return trimmed;
  };

  const handleAddSource = () => {
    addCrawlSource.mutate({
      chatbotId,
      rootUrl: normalizeUrl(rootUrl),
      crawlDepth,
      maxPages,
      includePatterns: includePatterns
        ? includePatterns
            .split(",")
            .map((p) => p.trim())
            .filter(Boolean)
        : [],
      excludePatterns: excludePatterns
        ? excludePatterns
            .split(",")
            .map((p) => p.trim())
            .filter(Boolean)
        : [],
    });
  };

  const handleAddManualUrl = () => {
    if (!manualUrl) return;
    addManualUrlMutation.mutate({ chatbotId, url: normalizeUrl(manualUrl) });
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
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Web Source
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Add Web Source</DialogTitle>
                <DialogDescription>
                  Enter a website URL to crawl and add to your chatbot&apos;s
                  knowledge base.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="rootUrl">Website URL</Label>
                  <Input
                    id="rootUrl"
                    placeholder="https://cs101.university.edu"
                    value={rootUrl}
                    onChange={(e) => setRootUrl(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="crawlDepth">Crawl Depth</Label>
                    <Input
                      id="crawlDepth"
                      type="number"
                      min={1}
                      max={5}
                      value={crawlDepth}
                      onChange={(e) =>
                        setCrawlDepth(parseInt(e.target.value) || 3)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxPages">Max Pages</Label>
                    <Input
                      id="maxPages"
                      type="number"
                      min={1}
                      max={500}
                      value={maxPages}
                      onChange={(e) =>
                        setMaxPages(parseInt(e.target.value) || 100)
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="includePatterns">
                    Include Patterns (comma-separated)
                  </Label>
                  <Input
                    id="includePatterns"
                    placeholder="/lectures/*, /syllabus"
                    value={includePatterns}
                    onChange={(e) => setIncludePatterns(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="excludePatterns">
                    Exclude Patterns (comma-separated)
                  </Label>
                  <Input
                    id="excludePatterns"
                    placeholder="/admin/*, /login"
                    value={excludePatterns}
                    onChange={(e) => setExcludePatterns(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setAddDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAddSource}
                  disabled={!rootUrl || addCrawlSource.isPending}
                >
                  {addCrawlSource.isPending && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  Start Crawl
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              placeholder="Add a single page URL..."
              value={manualUrl}
              onChange={(e) => setManualUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddManualUrl()}
            />
          </div>
          <Button
            variant="outline"
            onClick={handleAddManualUrl}
            disabled={!manualUrl || addManualUrlMutation.isPending}
          >
            {addManualUrlMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LinkIcon className="h-4 w-4" />
            )}
          </Button>
        </div>

        {sourcesLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-lg border p-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-5 w-5 rounded" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                  <Skeleton className="h-8 w-8 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : !sources || sources.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Globe className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No web sources yet</p>
            <p className="text-sm mt-1">
              Add a website URL to crawl or paste a single page URL above.
            </p>
          </div>
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
                isRecrawling={recrawl.isPending}
                isRemoving={removeCrawlSource.isPending}
                isTogglingEnabled={toggleCrawlSource.isPending}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CrawlSourceCard({
  source,
  isExpanded,
  onToggleExpand,
  onRecrawl,
  onRemove,
  onToggleEnabled,
  isRecrawling,
  isRemoving,
  isTogglingEnabled,
}: {
  source: {
    id: string;
    rootUrl: string;
    status: string;
    enabled: boolean;
    lastCrawledAt: Date | null;
    metadata: Record<string, unknown> | null;
    pageCounts: {
      pending: number;
      processing: number;
      completed: number;
      failed: number;
      blocked: number;
      skipped: number;
    };
  };
  isExpanded: boolean;
  onToggleExpand: () => void;
  onRecrawl: () => void;
  onRemove: () => void;
  onToggleEnabled: (enabled: boolean) => void;
  isRecrawling: boolean;
  isRemoving: boolean;
  isTogglingEnabled: boolean;
}) {
  const isActive =
    source.status === "pending" ||
    source.status === "discovering" ||
    source.status === "crawling";
  const pageCount = (source.metadata?.pageCount as number) ?? 0;
  const errorCount = (source.metadata?.errorCount as number) ?? 0;

  const exportJson = trpc.crawler.exportJson.useQuery(
    { crawlSourceId: source.id },
    { enabled: false },
  );

  const handleExport = async () => {
    try {
      const result = await exportJson.refetch();
      if (result.data) {
        const blob = new Blob([JSON.stringify(result.data, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `crawl-${new URL(source.rootUrl).hostname}-${new Date().toISOString().split("T")[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("JSON exported");
      }
    } catch {
      toast.error("Failed to export JSON");
    }
  };

  return (
    <div
      className={`rounded-lg border transition-opacity ${source.enabled ? "" : "opacity-60"}`}
    >
      <Collapsible open={isExpanded} onOpenChange={onToggleExpand}>
        <div className="flex items-center justify-between p-4">
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-3 text-left flex-1 min-w-0">
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
              <Globe className="h-5 w-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{source.rootUrl}</p>
                <div className="flex items-center gap-2 mt-1">
                  {!source.enabled && (
                    <Badge variant="secondary" className="text-xs">
                      Disabled
                    </Badge>
                  )}
                  {getSourceStatusBadge(source.status)}
                  {source.status === "completed" && (
                    <span className="text-xs text-muted-foreground">
                      {pageCount} page{pageCount !== 1 ? "s" : ""} crawled
                      {errorCount > 0 &&
                        `, ${errorCount} error${errorCount !== 1 ? "s" : ""}`}
                    </span>
                  )}
                  {source.lastCrawledAt && (
                    <span className="text-xs text-muted-foreground">
                      Last:{" "}
                      {new Date(source.lastCrawledAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            </button>
          </CollapsibleTrigger>
          <div className="flex items-center gap-2 ml-2">
            <div
              className="flex items-center"
              title={
                source.enabled
                  ? "Disable this source (keeps data, excludes from chat context)"
                  : "Enable this source"
              }
            >
              <Switch
                checked={source.enabled}
                onCheckedChange={onToggleEnabled}
                disabled={isTogglingEnabled}
                aria-label="Toggle source"
              />
            </div>
            {source.status === "completed" && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleExport}
                  title="Download JSON"
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onRecrawl}
                  disabled={isRecrawling}
                  title="Re-crawl"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${isRecrawling ? "animate-spin" : ""}`}
                  />
                </Button>
              </>
            )}
            {source.status === "failed" && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onRecrawl}
                disabled={isRecrawling}
                title="Retry"
              >
                <RefreshCw
                  className={`h-4 w-4 ${isRecrawling ? "animate-spin" : ""}`}
                />
              </Button>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={isRemoving || isActive}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove Web Source</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will remove the crawl source, all {pageCount} crawled
                    page{pageCount !== 1 ? "s" : ""}, and their embeddings. This
                    action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={onRemove}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Remove
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {isActive &&
          (() => {
            const { pending, processing, completed, failed, blocked, skipped } =
              source.pageCounts;
            const total =
              pending + processing + completed + failed + blocked + skipped;
            let progress = 0;
            let label = "Waiting to start...";

            if (source.status === "pending") {
              progress = 5;
              label = "Waiting to start...";
            } else if (source.status === "discovering") {
              progress = 15;
              label = "Discovering pages...";
            } else if (source.status === "crawling" && total > 0) {
              const done = completed + failed + blocked + skipped;
              progress = 20 + Math.round((done / total) * 80);
              label = `Processing ${done} of ${total} pages...`;
            } else if (source.status === "crawling") {
              progress = 20;
              label = "Processing pages...";
            }

            return (
              <div className="px-4 pb-3">
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-muted-foreground mt-1">{label}</p>
              </div>
            );
          })()}

        <CollapsibleContent>
          <CrawledPagesList
            crawlSourceId={source.id}
            isExpanded={isExpanded}
          />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function CrawledPagesList({
  crawlSourceId,
  isExpanded,
}: {
  crawlSourceId: string;
  isExpanded: boolean;
}) {
  const [offset, setOffset] = useState(0);
  const limit = 10;
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.crawler.getCrawledPages.useQuery(
    {
      crawlSourceId,
      limit,
      offset,
    },
    { enabled: isExpanded },
  );

  const removeCrawledPage = trpc.crawler.removeCrawledPage.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.crawler.getCrawledPages.invalidate({ crawlSourceId }),
        utils.crawler.getCrawlSources.invalidate(),
      ]);
      toast.success("Page removed");
    },
    onError: (error) => {
      toast.error("Failed to remove page", {
        description: getFriendlyError(error),
      });
    },
  });

  if (isLoading || !data) {
    return (
      <div className="border-t">
        <div className="divide-y">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex items-center justify-between px-4 py-2.5"
            >
              <div className="min-w-0 flex-1 mr-3 space-y-1.5">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="h-5 w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (data.pages.length === 0) {
    return (
      <div className="px-4 pb-4 text-sm text-muted-foreground">
        No pages crawled yet.
      </div>
    );
  }

  return (
    <div className="border-t">
      <div className="divide-y">
        {data.pages.map(
          (page: {
            id: string;
            title: string | null;
            url: string;
            status: string;
            metadata: Record<string, unknown> | null;
          }) => (
            <div
              key={page.id}
              className="flex items-center justify-between px-4 py-2.5"
            >
              <div className="min-w-0 flex-1 mr-3">
                <p className="text-sm truncate">{page.title || page.url}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <a
                    href={page.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground hover:text-foreground truncate flex items-center gap-1"
                  >
                    {page.url}
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                  {typeof page.metadata?.wordCount === "number" && (
                    <span className="text-xs text-muted-foreground shrink-0">
                      {page.metadata.wordCount.toLocaleString()} words
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {getPageStatusBadge(page.status)}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      disabled={removeCrawledPage.isPending}
                      title="Remove page"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remove page</AlertDialogTitle>
                      <AlertDialogDescription>
                        Remove &quot;{page.title || page.url}&quot; from this
                        chatbot&apos;s knowledge? This deletes the page and its
                        embeddings. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() =>
                          removeCrawledPage.mutate({ crawledPageId: page.id })
                        }
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Remove
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ),
        )}
      </div>
      {data.totalCount > limit && (
        <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/50">
          <span className="text-xs text-muted-foreground">
            Showing {offset + 1}-{Math.min(offset + limit, data.totalCount)} of{" "}
            {data.totalCount}
          </span>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOffset(Math.max(0, offset - limit))}
              disabled={offset === 0}
            >
              Previous
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOffset(offset + limit)}
              disabled={offset + limit >= data.totalCount}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
