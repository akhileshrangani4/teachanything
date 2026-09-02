"use client";

import { ChevronDown, Globe } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EditableName } from "@/components/ui/editable-name";
import { Switch } from "@/components/ui/switch";
import {
  getSourceDisplayName,
  getSourceErrorCount,
  getSourcePageCount,
} from "@/lib/crawler-metadata";
import { useExportSource } from "@/hooks/use-export-source";
import { isActiveSource } from "../utils";
import { CrawlProgress } from "../CrawlProgress";
import { CrawledPagesList } from "../CrawledPagesList";
import { SourceStatusBadge } from "../StatusBadges";
import { WebSourceRowActions } from "./row-actions";
import type { WebSourceRowProps } from "./types";

// ── Mobile card view ─────────────────────────────────────────────────
export function WebSourceCardMobile({
  source,
  showCheckbox = false,
  isSelected = false,
  onToggleSelect,
  isExpanded = false,
  onToggleExpand,
  onRecrawl,
  onRemove,
  onStop,
  onToggleEnabled,
  onRename,
  isRecrawling = false,
  isRemoving = false,
  isStopping = false,
  isTogglingEnabled = false,
  isRenaming = false,
}: WebSourceRowProps) {
  const handleExport = useExportSource(source.id, source.rootUrl);
  const isActive = isActiveSource(source);
  const pageCount = getSourcePageCount(source);
  const errorCount = getSourceErrorCount(source);

  return (
    <div
      className={`border border-border/60 rounded-lg p-4 bg-card space-y-3 ${
        source.enabled ? "" : "opacity-60"
      }`}
    >
      <div className="flex items-center gap-3">
        {showCheckbox && onToggleSelect && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect(source.id)}
            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer flex-shrink-0"
            aria-label={`Select ${getSourceDisplayName(source)}`}
          />
        )}
        <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
          <Globe className="h-4 w-4 text-blue-600" />
        </div>
        <EditableName
          value={getSourceDisplayName(source)}
          fallback={source.rootUrl}
          ariaLabel="Rename web source"
          isSaving={isRenaming}
          onSave={(name) => onRename(source.id, name)}
          className="text-sm font-medium flex-1 min-w-0"
        />
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {source.enabled ? (
          <SourceStatusBadge status={source.status} />
        ) : (
          <Badge variant="secondary">Disabled</Badge>
        )}
        <span className="bg-muted px-2 py-0.5 rounded text-xs text-muted-foreground">
          {pageCount} page{pageCount !== 1 ? "s" : ""}
        </span>
        {source.status === "completed" && errorCount > 0 && (
          <span className="bg-muted px-2 py-0.5 rounded text-xs text-muted-foreground">
            {errorCount} error{errorCount !== 1 ? "s" : ""}
          </span>
        )}
        {source.lastCrawledAt && (
          <span className="bg-muted px-2 py-0.5 rounded text-xs text-muted-foreground">
            Last: {new Date(source.lastCrawledAt).toLocaleDateString()}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <div
          title={
            source.enabled
              ? "Disable this source (keeps data, excludes from chat context)"
              : "Enable this source"
          }
        >
          <Switch
            checked={source.enabled}
            onCheckedChange={(enabled) => onToggleEnabled(source.id, enabled)}
            disabled={isTogglingEnabled}
            aria-label="Toggle source"
          />
        </div>
        <div className="flex items-center gap-2">
          <WebSourceRowActions
            source={source}
            isRecrawling={isRecrawling}
            isRemoving={isRemoving}
            isStopping={isStopping}
            onExport={handleExport}
            onRecrawl={() => onRecrawl(source.id)}
            onRemove={() => onRemove(source.id)}
            onStop={() => onStop(source.id)}
          />
          {onToggleExpand && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => onToggleExpand(source.id)}
              aria-label={
                isExpanded ? "Hide crawled pages" : "Show crawled pages"
              }
            >
              <ChevronDown
                className={`h-4 w-4 transition-transform ${
                  isExpanded ? "rotate-180" : ""
                }`}
              />
            </Button>
          )}
        </div>
      </div>

      {isExpanded && (
        <div>
          {isActive && (
            <CrawlProgress
              status={source.status}
              pageCounts={source.pageCounts}
            />
          )}
          <CrawledPagesList crawlSourceId={source.id} isExpanded />
        </div>
      )}
    </div>
  );
}
