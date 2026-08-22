"use client";

import {
  Download,
  ChevronDown,
  Globe,
  RefreshCw,
  Trash2,
  CircleStop,
} from "lucide-react";
import type { RouterOutputs } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EditableName } from "@/components/ui/editable-name";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertDialog, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import {
  SortableTableHead,
  type WebSourceSortBy,
} from "@/components/data-table";
import type { SortDirection } from "@/hooks/useServerTable";
import {
  getSourceDisplayName,
  getSourceErrorCount,
  getSourcePageCount,
} from "@/lib/crawler-metadata";
import { useExportSource } from "@/hooks/use-export-source";
import { isActiveSource } from "./utils";
import { ConfirmDialogContent } from "./ConfirmDialogContent";
import { ResponsiveTableShell } from "./ResponsiveTableShell";
import { CrawlProgress } from "./CrawlProgress";
import { CrawledPagesList } from "./CrawledPagesList";
import { SourceStatusBadge } from "./StatusBadges";

type CrawlSource = RouterOutputs["crawler"]["getCrawlSources"][number];

// ── Shared row actions (export / recrawl / remove) ───────────────────
function WebSourceRowActions({
  source,
  isRecrawling,
  isRemoving,
  isStopping,
  onExport,
  onRecrawl,
  onRemove,
  onStop,
}: {
  source: CrawlSource;
  isRecrawling: boolean;
  isRemoving: boolean;
  isStopping: boolean;
  onExport: () => void;
  onRecrawl: () => void;
  onRemove: () => void;
  onStop: () => void;
}) {
  const isActive = isActiveSource(source);
  return (
    <>
      {isActive && <StopCrawlButton onStop={onStop} isStopping={isStopping} />}
      {source.status === "completed" && (
        <>
          <Button
            variant="ghost"
            size="icon"
            onClick={onExport}
            className="h-8 w-8"
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
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={isRemoving}
            title="Remove from chatbot"
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </AlertDialogTrigger>
        <ConfirmDialogContent
          title="Remove from chatbot"
          description="Remove this web source from this chatbot? Its content stays available to attach again."
          cancelLabel="Cancel"
          confirmLabel="Remove from chatbot"
          onConfirm={onRemove}
        />
      </AlertDialog>
    </>
  );
}

// Lets the user abandon a crawl that is running long or was started by mistake.
function StopCrawlButton({
  onStop,
  isStopping,
}: {
  onStop: () => void;
  isStopping: boolean;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          disabled={isStopping}
          title="Stop crawl"
        >
          <CircleStop className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <ConfirmDialogContent
        title="Stop crawl"
        description="Stop this crawl now. Pages already crawled are kept; the rest are skipped. You can re-crawl or remove the source afterwards."
        cancelLabel="Keep crawling"
        confirmLabel="Stop crawl"
        onConfirm={onStop}
      />
    </AlertDialog>
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
      className="h-8 w-8"
      title={title}
    >
      <RefreshCw className={`h-4 w-4 ${isRecrawling ? "animate-spin" : ""}`} />
    </Button>
  );
}

// ── Per-source props shared by desktop and mobile ────────────────────
interface WebSourceRowProps {
  source: CrawlSource;
  showCheckbox?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (sourceId: string) => void;
  isExpanded?: boolean;
  onToggleExpand?: (sourceId: string) => void;
  onRecrawl: (sourceId: string) => void;
  onRemove: (sourceId: string) => void;
  onStop: (sourceId: string) => void;
  onToggleEnabled: (sourceId: string, enabled: boolean) => void;
  onRename: (sourceId: string, name: string) => Promise<unknown>;
  isRecrawling?: boolean;
  isRemoving?: boolean;
  isStopping?: boolean;
  isTogglingEnabled?: boolean;
  isRenaming?: boolean;
}

// ── Desktop table row (+ optional expanded pages row) ────────────────
function WebSourceTableRow({
  source,
  colSpan,
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
}: WebSourceRowProps & { colSpan: number }) {
  const handleExport = useExportSource(source.id, source.rootUrl);
  const isActive = isActiveSource(source);
  const pageCount = getSourcePageCount(source);
  const errorCount = getSourceErrorCount(source);

  return (
    <>
      <TableRow className={source.enabled ? "" : "opacity-60"}>
        {showCheckbox && onToggleSelect && (
          <TableCell onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggleSelect(source.id)}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
              aria-label={`Select ${getSourceDisplayName(source)}`}
            />
          </TableCell>
        )}
        <TableCell>
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
              <Globe className="h-4 w-4 text-blue-600" />
            </div>
            <EditableName
              value={getSourceDisplayName(source)}
              fallback={source.rootUrl}
              ariaLabel="Rename web source"
              isSaving={isRenaming}
              onSave={(name) => onRename(source.id, name)}
              className="text-sm font-medium min-w-0"
            />
          </div>
        </TableCell>
        <TableCell>
          <span className="text-sm whitespace-nowrap">
            {pageCount} page{pageCount !== 1 ? "s" : ""}
          </span>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            {source.enabled ? (
              <SourceStatusBadge status={source.status} />
            ) : (
              <Badge variant="secondary">Disabled</Badge>
            )}
            {source.status === "completed" && errorCount > 0 && (
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {errorCount} error{errorCount !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </TableCell>
        <TableCell>
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {source.lastCrawledAt
              ? new Date(source.lastCrawledAt).toLocaleDateString()
              : "—"}
          </span>
        </TableCell>
        <TableCell className="text-right">
          <div className="flex items-center justify-end gap-2">
            <div
              title={
                source.enabled
                  ? "Disable this source (keeps data, excludes from chat context)"
                  : "Enable this source"
              }
            >
              <Switch
                checked={source.enabled}
                onCheckedChange={(enabled) =>
                  onToggleEnabled(source.id, enabled)
                }
                disabled={isTogglingEnabled}
                aria-label="Toggle source"
              />
            </div>
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
                  isExpanded
                    ? `Hide crawled pages for ${getSourceDisplayName(source)}`
                    : `Show crawled pages for ${getSourceDisplayName(source)}`
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
        </TableCell>
      </TableRow>
      {isExpanded && (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={colSpan} className="p-0">
            {isActive && (
              <CrawlProgress
                status={source.status}
                pageCounts={source.pageCounts}
              />
            )}
            <CrawledPagesList crawlSourceId={source.id} isExpanded />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

// ── Mobile card view ─────────────────────────────────────────────────
function WebSourceCardMobile({
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

// ── Main WebSourceTable component ────────────────────────────────────
interface WebSourceTableProps {
  sources: CrawlSource[];
  showCheckbox?: boolean;
  selectedSources?: Set<string>;
  onToggleSelect?: (sourceId: string) => void;
  onSelectAll?: () => void;
  allSelected?: boolean;
  expandedSources?: Set<string>;
  onToggleExpand?: (sourceId: string) => void;
  onRecrawl: (sourceId: string) => void;
  onRemove: (sourceId: string) => void;
  onStop: (sourceId: string) => void;
  onToggleEnabled: (sourceId: string, enabled: boolean) => void;
  onRename: (sourceId: string, name: string) => Promise<unknown>;
  isRecrawling?: boolean;
  isRemoving?: boolean;
  isStopping?: boolean;
  isTogglingEnabled?: boolean;
  isRenaming?: boolean;
  emptyMessage?: string;
  sortBy?: WebSourceSortBy;
  sortDir?: SortDirection;
  onSort?: (column: WebSourceSortBy) => void;
}

export function WebSourceTable({
  sources,
  showCheckbox = false,
  selectedSources,
  onToggleSelect,
  onSelectAll,
  allSelected = false,
  expandedSources,
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
  emptyMessage = "No web sources found",
  sortBy,
  sortDir,
  onSort,
}: WebSourceTableProps) {
  const isSortable =
    sortBy !== undefined && sortDir !== undefined && onSort !== undefined;

  const renderColumnHeader = (
    column: WebSourceSortBy,
    label: string,
    className?: string,
  ) => {
    if (isSortable) {
      return (
        <SortableTableHead
          column={column}
          currentSortBy={sortBy}
          currentSortDir={sortDir}
          onSort={onSort}
          className={className}
        >
          {label}
        </SortableTableHead>
      );
    }
    return <TableHead className={className}>{label}</TableHead>;
  };

  if (sources.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  const hasCheckbox = showCheckbox && !!onSelectAll;
  // checkbox(3) + pages(10) + status(20) + lastCrawled(15) + actions(18)
  const fixedWidth = (hasCheckbox ? 3 : 0) + 10 + 20 + 15 + 18;
  const nameWidth = 100 - fixedWidth;
  const colSpan = (hasCheckbox ? 1 : 0) + 5;

  return (
    <ResponsiveTableShell
      selectAll={
        showCheckbox && onSelectAll
          ? {
              checked: allSelected,
              onChange: onSelectAll,
              ariaLabel: "Select all web sources",
            }
          : undefined
      }
      desktop={
        <Table style={{ tableLayout: "fixed" }}>
          <colgroup>
            {hasCheckbox && <col style={{ width: "3%" }} />}
            <col style={{ width: `${nameWidth}%` }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "20%" }} />
            <col style={{ width: "15%" }} />
            <col style={{ width: "18%" }} />
          </colgroup>
          <TableHeader>
            <TableRow>
              {hasCheckbox && (
                <TableHead>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={onSelectAll}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                    aria-label="Select all web sources"
                  />
                </TableHead>
              )}
              {renderColumnHeader("name", "Name")}
              {renderColumnHeader("pageCount", "Pages", "whitespace-nowrap")}
              {renderColumnHeader("status", "Status", "whitespace-nowrap")}
              {renderColumnHeader(
                "lastCrawledAt",
                "Last Crawled",
                "whitespace-nowrap",
              )}
              <TableHead className="whitespace-nowrap text-right">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sources.map((source) => (
              <WebSourceTableRow
                key={source.id}
                source={source}
                colSpan={colSpan}
                showCheckbox={showCheckbox}
                isSelected={selectedSources?.has(source.id)}
                onToggleSelect={onToggleSelect}
                isExpanded={expandedSources?.has(source.id)}
                onToggleExpand={onToggleExpand}
                onRecrawl={onRecrawl}
                onRemove={onRemove}
                onStop={onStop}
                onToggleEnabled={onToggleEnabled}
                onRename={onRename}
                isRecrawling={isRecrawling}
                isRemoving={isRemoving}
                isStopping={isStopping}
                isTogglingEnabled={isTogglingEnabled}
                isRenaming={isRenaming}
              />
            ))}
          </TableBody>
        </Table>
      }
      mobile={sources.map((source) => (
        <WebSourceCardMobile
          key={source.id}
          source={source}
          showCheckbox={showCheckbox}
          isSelected={selectedSources?.has(source.id)}
          onToggleSelect={onToggleSelect}
          isExpanded={expandedSources?.has(source.id)}
          onToggleExpand={onToggleExpand}
          onRecrawl={onRecrawl}
          onRemove={onRemove}
          onStop={onStop}
          onToggleEnabled={onToggleEnabled}
          onRename={onRename}
          isRecrawling={isRecrawling}
          isRemoving={isRemoving}
          isStopping={isStopping}
          isTogglingEnabled={isTogglingEnabled}
          isRenaming={isRenaming}
        />
      ))}
    />
  );
}
