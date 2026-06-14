"use client";

import {
  Bot,
  ChevronDown,
  Download,
  ExternalLink,
  Globe,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { trpc, type RouterOutputs } from "@/lib/trpc";
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
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
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
  SortableTableHead,
  type WebSourceSortBy,
} from "@/components/data-table";
import type { SortDirection } from "@/hooks/useServerTable";
import { getSourceDisplayName } from "@/lib/crawler-metadata";
import { CrawlProgress } from "@/components/chatbot/web-sources/CrawlProgress";
import { CrawledPagesList } from "@/components/chatbot/web-sources/CrawledPagesList";
import { SourceStatusBadge } from "@/components/chatbot/web-sources/status-badges";

type DashboardSource =
  RouterOutputs["crawler"]["getAllCrawlSources"]["sources"][number];

type Chatbot = { id: string; name: string };

// getAllCrawlSources does not return per-status page counts, so the dashboard
// progress bar renders from status alone (counts zeroed).
const ZERO_PAGE_COUNTS = {
  pending: 0,
  processing: 0,
  completed: 0,
  failed: 0,
  blocked: 0,
  skipped: 0,
} as const;

function isActiveSource(source: DashboardSource): boolean {
  return (
    source.status === "pending" ||
    source.status === "discovering" ||
    source.status === "crawling"
  );
}

// Sortable subset of WebSourceSortBy supported on this page.
export type DashboardSortBy = Extract<
  WebSourceSortBy,
  "name" | "status" | "lastCrawledAt" | "createdAt"
>;

interface DashboardWebSourceTableProps {
  sources: DashboardSource[];
  chatbots: Chatbot[];
  selectedSources: Set<string>;
  onToggleSelect: (sourceId: string) => void;
  onSelectAll: () => void;
  allSelected: boolean;
  expandedSources: Set<string>;
  onToggleExpand: (sourceId: string) => void;
  onAttach: (sourceId: string, chatbotId: string) => void;
  onDetach: (sourceId: string, chatbotId: string) => void;
  isAttaching: boolean;
  onRecrawl: (sourceId: string) => void;
  onDelete: (sourceId: string) => void;
  onToggleEnabled: (sourceId: string, enabled: boolean) => void;
  onRename: (sourceId: string, name: string) => Promise<unknown>;
  isRecrawling: boolean;
  isDeleting: boolean;
  isTogglingEnabled: boolean;
  isRenaming: boolean;
  sortBy: DashboardSortBy;
  sortDir: SortDirection;
  onSort: (column: DashboardSortBy) => void;
}

function useExportSource(source: DashboardSource) {
  const utils = trpc.useUtils();
  return async () => {
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
}

function ChatbotAttachMenu({
  source,
  chatbots,
  onAttach,
  onDetach,
  isPending,
}: {
  source: DashboardSource;
  chatbots: Chatbot[];
  onAttach: (sourceId: string, chatbotId: string) => void;
  onDetach: (sourceId: string, chatbotId: string) => void;
  isPending: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 shrink-0">
          <Bot className="mr-1.5 h-3.5 w-3.5" />
          {source.chatbots.length > 0 ? source.chatbots.length : "Attach"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Attach to chatbots</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {chatbots.length === 0 ? (
          <div className="px-2 py-1.5 text-sm text-muted-foreground">
            No chatbots yet. Create one to attach this source.
          </div>
        ) : (
          chatbots.map((chatbot) => {
            const attached = source.chatbots.some((c) => c.id === chatbot.id);
            return (
              <DropdownMenuCheckboxItem
                key={chatbot.id}
                checked={attached}
                disabled={isPending}
                onSelect={(e) => e.preventDefault()}
                onCheckedChange={(checked) => {
                  if (checked) {
                    onAttach(source.id, chatbot.id);
                  } else {
                    onDetach(source.id, chatbot.id);
                  }
                }}
              >
                <span className="truncate">{chatbot.name}</span>
              </DropdownMenuCheckboxItem>
            );
          })
        )}
      </DropdownMenuContent>
    </DropdownMenu>
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

function DeleteSourceButton({
  source,
  onDelete,
  isDeleting,
}: {
  source: DashboardSource;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const isActive = isActiveSource(source);
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          disabled={isDeleting || isActive}
          title={
            isActive ? "Cannot delete while crawling" : "Delete web source"
          }
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete web source</AlertDialogTitle>
          <AlertDialogDescription>
            Permanently delete this web source and all of its crawled pages. It
            will be detached from every chatbot. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onDelete}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete permanently
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface RowProps {
  source: DashboardSource;
  chatbots: Chatbot[];
  isSelected: boolean;
  onToggleSelect: (sourceId: string) => void;
  isExpanded: boolean;
  onToggleExpand: (sourceId: string) => void;
  onAttach: (sourceId: string, chatbotId: string) => void;
  onDetach: (sourceId: string, chatbotId: string) => void;
  isAttaching: boolean;
  onRecrawl: (sourceId: string) => void;
  onDelete: (sourceId: string) => void;
  onToggleEnabled: (sourceId: string, enabled: boolean) => void;
  onRename: (sourceId: string, name: string) => Promise<unknown>;
  isRecrawling: boolean;
  isDeleting: boolean;
  isTogglingEnabled: boolean;
  isRenaming: boolean;
}

function SourceRowActions({
  source,
  onExport,
  onRecrawl,
  onDelete,
  isRecrawling,
  isDeleting,
}: {
  source: DashboardSource;
  onExport: () => void;
  onRecrawl: () => void;
  onDelete: () => void;
  isRecrawling: boolean;
  isDeleting: boolean;
}) {
  return (
    <>
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
      <DeleteSourceButton
        source={source}
        onDelete={onDelete}
        isDeleting={isDeleting}
      />
    </>
  );
}

function DashboardTableRow({
  source,
  colSpan,
  chatbots,
  isSelected,
  onToggleSelect,
  isExpanded,
  onToggleExpand,
  onAttach,
  onDetach,
  isAttaching,
  onRecrawl,
  onDelete,
  onToggleEnabled,
  onRename,
  isRecrawling,
  isDeleting,
  isTogglingEnabled,
  isRenaming,
}: RowProps & { colSpan: number }) {
  const handleExport = useExportSource(source);
  const isActive = isActiveSource(source);

  return (
    <>
      <TableRow className={source.enabled ? "" : "opacity-60"}>
        <TableCell onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect(source.id)}
            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
            aria-label={`Select ${getSourceDisplayName(source)}`}
          />
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Globe className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <EditableName
                value={getSourceDisplayName(source)}
                fallback={source.rootUrl}
                ariaLabel="Rename web source"
                isSaving={isRenaming}
                onSave={(name) => onRename(source.id, name)}
                className="text-sm font-medium"
              />
              <a
                href={source.rootUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <span className="truncate">{source.rootUrl}</span>
                <ExternalLink className="h-3 w-3 shrink-0" />
              </a>
            </div>
          </div>
        </TableCell>
        <TableCell>
          <span className="text-sm whitespace-nowrap">
            {source.pageCount} page{source.pageCount !== 1 ? "s" : ""}
          </span>
        </TableCell>
        <TableCell>
          {source.enabled ? (
            <SourceStatusBadge status={source.status} />
          ) : (
            <Badge variant="secondary">Disabled</Badge>
          )}
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            {source.chatbots.length === 0 ? (
              <span className="text-xs text-muted-foreground">
                Not attached
              </span>
            ) : (
              <span className="text-xs text-muted-foreground truncate max-w-[140px]">
                {source.chatbots.map((c) => c.name).join(", ")}
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
          <div className="flex items-center justify-end gap-1.5">
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
            <ChatbotAttachMenu
              source={source}
              chatbots={chatbots}
              onAttach={onAttach}
              onDetach={onDetach}
              isPending={isAttaching}
            />
            <SourceRowActions
              source={source}
              onExport={handleExport}
              onRecrawl={() => onRecrawl(source.id)}
              onDelete={() => onDelete(source.id)}
              isRecrawling={isRecrawling}
              isDeleting={isDeleting}
            />
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
          </div>
        </TableCell>
      </TableRow>
      {isExpanded && (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={colSpan} className="p-0">
            {isActive && (
              <CrawlProgress
                status={source.status}
                pageCounts={ZERO_PAGE_COUNTS}
              />
            )}
            <CrawledPagesList crawlSourceId={source.id} isExpanded />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function DashboardSourceCardMobile(props: RowProps) {
  const {
    source,
    chatbots,
    isSelected,
    onToggleSelect,
    isExpanded,
    onToggleExpand,
    onAttach,
    onDetach,
    isAttaching,
    onRecrawl,
    onDelete,
    onToggleEnabled,
    onRename,
    isRecrawling,
    isDeleting,
    isTogglingEnabled,
    isRenaming,
  } = props;
  const handleExport = useExportSource(source);
  const isActive = isActiveSource(source);

  return (
    <div
      className={`border border-border/60 rounded-lg p-4 bg-card space-y-3 ${
        source.enabled ? "" : "opacity-60"
      }`}
    >
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(source.id)}
          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer flex-shrink-0"
          aria-label={`Select ${getSourceDisplayName(source)}`}
        />
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Globe className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <EditableName
            value={getSourceDisplayName(source)}
            fallback={source.rootUrl}
            ariaLabel="Rename web source"
            isSaving={isRenaming}
            onSave={(name) => onRename(source.id, name)}
            className="text-sm font-medium"
          />
          <a
            href={source.rootUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <span className="truncate">{source.rootUrl}</span>
            <ExternalLink className="h-3 w-3 shrink-0" />
          </a>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {source.enabled ? (
          <SourceStatusBadge status={source.status} />
        ) : (
          <Badge variant="secondary">Disabled</Badge>
        )}
        <span className="bg-muted px-2 py-0.5 rounded text-xs text-muted-foreground">
          {source.pageCount} page{source.pageCount !== 1 ? "s" : ""}
        </span>
        {source.chatbots.length === 0 ? (
          <Badge variant="outline">Not attached</Badge>
        ) : (
          source.chatbots.map((c) => (
            <Badge key={c.id} variant="secondary" className="gap-1">
              <Bot className="h-3 w-3" />
              {c.name}
            </Badge>
          ))
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
        <div className="flex items-center gap-1.5">
          <ChatbotAttachMenu
            source={source}
            chatbots={chatbots}
            onAttach={onAttach}
            onDetach={onDetach}
            isPending={isAttaching}
          />
          <SourceRowActions
            source={source}
            onExport={handleExport}
            onRecrawl={() => onRecrawl(source.id)}
            onDelete={() => onDelete(source.id)}
            isRecrawling={isRecrawling}
            isDeleting={isDeleting}
          />
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
        </div>
      </div>

      {isExpanded && (
        <div>
          {isActive && (
            <CrawlProgress
              status={source.status}
              pageCounts={ZERO_PAGE_COUNTS}
            />
          )}
          <CrawledPagesList crawlSourceId={source.id} isExpanded />
        </div>
      )}
    </div>
  );
}

export function DashboardWebSourceTable({
  sources,
  chatbots,
  selectedSources,
  onToggleSelect,
  onSelectAll,
  allSelected,
  expandedSources,
  onToggleExpand,
  onAttach,
  onDetach,
  isAttaching,
  onRecrawl,
  onDelete,
  onToggleEnabled,
  onRename,
  isRecrawling,
  isDeleting,
  isTogglingEnabled,
  isRenaming,
  sortBy,
  sortDir,
  onSort,
}: DashboardWebSourceTableProps) {
  // 7 columns: checkbox, name, pages, status, chatbots, last crawled, actions
  const colSpan = 7;

  const rowProps = (source: DashboardSource): RowProps => ({
    source,
    chatbots,
    isSelected: selectedSources.has(source.id),
    onToggleSelect,
    isExpanded: expandedSources.has(source.id),
    onToggleExpand,
    onAttach,
    onDetach,
    isAttaching,
    onRecrawl,
    onDelete,
    onToggleEnabled,
    onRename,
    isRecrawling,
    isDeleting,
    isTogglingEnabled,
    isRenaming,
  });

  return (
    <>
      {/* Desktop table view */}
      <div className="hidden md:block">
        <Table style={{ tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: "3%" }} />
            <col style={{ width: "29%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "13%" }} />
            <col style={{ width: "15%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "18%" }} />
          </colgroup>
          <TableHeader>
            <TableRow>
              <TableHead>
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onSelectAll}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                  aria-label="Select all web sources"
                />
              </TableHead>
              <SortableTableHead
                column="name"
                currentSortBy={sortBy}
                currentSortDir={sortDir}
                onSort={onSort}
              >
                Name
              </SortableTableHead>
              <TableHead className="whitespace-nowrap">Pages</TableHead>
              <SortableTableHead
                column="status"
                currentSortBy={sortBy}
                currentSortDir={sortDir}
                onSort={onSort}
                className="whitespace-nowrap"
              >
                Status
              </SortableTableHead>
              <TableHead className="whitespace-nowrap">Chatbots</TableHead>
              <SortableTableHead
                column="lastCrawledAt"
                currentSortBy={sortBy}
                currentSortDir={sortDir}
                onSort={onSort}
                className="whitespace-nowrap"
              >
                Last Crawled
              </SortableTableHead>
              <TableHead className="whitespace-nowrap text-right">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sources.map((source) => (
              <DashboardTableRow
                key={source.id}
                colSpan={colSpan}
                {...rowProps(source)}
              />
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile card view */}
      <div className="md:hidden space-y-3">
        <div className="flex items-center gap-2 px-1">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={onSelectAll}
            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
            aria-label="Select all web sources"
          />
          <span className="text-sm text-muted-foreground">Select all</span>
        </div>
        {sources.map((source) => (
          <DashboardSourceCardMobile key={source.id} {...rowProps(source)} />
        ))}
      </div>
    </>
  );
}
