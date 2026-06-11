"use client";

import { Download, ChevronDown, Globe, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { trpc, type RouterOutputs } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EditableName } from "@/components/ui/editable-name";
import { Switch } from "@/components/ui/switch";
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
import {
  getSourceDisplayName,
  getSourceErrorCount,
  getSourcePageCount,
} from "@/lib/crawler-metadata";
import { CrawlProgress } from "./CrawlProgress";
import { CrawledPagesList } from "./CrawledPagesList";
import { SourceStatusBadge } from "./status-badges";

type CrawlSource = RouterOutputs["crawler"]["getCrawlSources"][number];

export function CrawlSourceCard({
  source,
  isExpanded,
  onToggleExpand,
  onRecrawl,
  onRemove,
  onToggleEnabled,
  onRename,
  isRecrawling,
  isRemoving,
  isTogglingEnabled,
  isRenaming,
}: {
  source: CrawlSource;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onRecrawl: () => void;
  onRemove: () => void;
  onToggleEnabled: (enabled: boolean) => void;
  onRename: (name: string) => Promise<unknown>;
  isRecrawling: boolean;
  isRemoving: boolean;
  isTogglingEnabled: boolean;
  isRenaming: boolean;
}) {
  const isActive =
    source.status === "pending" ||
    source.status === "discovering" ||
    source.status === "crawling";
  const pageCount = getSourcePageCount(source);
  const errorCount = getSourceErrorCount(source);
  const pageLabel = `${pageCount} page${pageCount !== 1 ? "s" : ""}`;
  const utils = trpc.useUtils();

  const handleExport = async () => {
    try {
      const data = await utils.crawler.exportJson.fetch({
        crawlSourceId: source.id,
      });
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `crawl-${new URL(source.rootUrl).hostname}-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("JSON exported");
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
          <div className="flex items-center gap-3 text-left flex-1 min-w-0">
            <Globe className="h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <EditableName
                value={getSourceDisplayName(source)}
                fallback={source.rootUrl}
                ariaLabel="Rename web source"
                isSaving={isRenaming}
                onSave={onRename}
                className="text-sm font-medium"
              />
              <div className="flex flex-wrap items-center gap-2 mt-1">
                {source.enabled ? (
                  <SourceStatusBadge status={source.status} />
                ) : (
                  <Badge variant="secondary">Disabled</Badge>
                )}
                {source.status === "completed" && (
                  <span className="text-xs text-muted-foreground">
                    {errorCount > 0
                      ? `${errorCount} error${errorCount !== 1 ? "s" : ""}`
                      : "Crawl complete"}
                  </span>
                )}
                {source.lastCrawledAt && (
                  <span className="text-xs text-muted-foreground">
                    Last: {new Date(source.lastCrawledAt).toLocaleDateString()}
                  </span>
                )}
                <CollapsibleTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
                    aria-label={
                      isExpanded
                        ? `Hide crawled pages for ${getSourceDisplayName(source)}`
                        : `Show ${pageLabel} for ${getSourceDisplayName(source)}`
                    }
                  >
                    {isExpanded ? "Hide pages" : `Show ${pageLabel}`}
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition-transform ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                    />
                  </Button>
                </CollapsibleTrigger>
              </div>
            </div>
          </div>
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
            <CrawlSourceActions
              source={source}
              isActive={isActive}
              isRecrawling={isRecrawling}
              isRemoving={isRemoving}
              onExport={handleExport}
              onRecrawl={onRecrawl}
              onRemove={onRemove}
            />
          </div>
        </div>

        {isActive && (
          <CrawlProgress
            status={source.status}
            pageCounts={source.pageCounts}
          />
        )}

        <CollapsibleContent>
          <CrawledPagesList crawlSourceId={source.id} isExpanded={isExpanded} />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function CrawlSourceActions({
  source,
  isActive,
  isRecrawling,
  isRemoving,
  onExport,
  onRecrawl,
  onRemove,
}: {
  source: CrawlSource;
  isActive: boolean;
  isRecrawling: boolean;
  isRemoving: boolean;
  onExport: () => void;
  onRecrawl: () => void;
  onRemove: () => void;
}) {
  return (
    <>
      {source.status === "completed" && (
        <>
          <Button
            variant="ghost"
            size="icon"
            onClick={onExport}
            title="Download JSON"
          >
            <Download className="h-4 w-4" />
          </Button>
          <RecrawlButton onRecrawl={onRecrawl} isRecrawling={isRecrawling} />
        </>
      )}
      {source.status === "failed" && (
        <RecrawlButton
          onRecrawl={onRecrawl}
          isRecrawling={isRecrawling}
          title="Retry"
        />
      )}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="icon" disabled={isRemoving || isActive}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from chatbot</AlertDialogTitle>
            <AlertDialogDescription>
              Remove this web source from this chatbot? Its content stays
              available to attach again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onRemove}>
              Remove from chatbot
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function RecrawlButton({
  onRecrawl,
  isRecrawling,
  title = "Re-crawl",
}: {
  onRecrawl: () => void;
  isRecrawling: boolean;
  title?: string;
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onRecrawl}
      disabled={isRecrawling}
      title={title}
    >
      <RefreshCw className={`h-4 w-4 ${isRecrawling ? "animate-spin" : ""}`} />
    </Button>
  );
}
