"use client";

import { useState } from "react";
import {
  Bot,
  ChevronDown,
  Download,
  ExternalLink,
  Globe,
  MoreVertical,
  Plus,
  RefreshCw,
  Trash2,
  CircleStop,
} from "lucide-react";
import type { RouterOutputs } from "@/lib/trpc";
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
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { AlertDialog } from "@/components/ui/alert-dialog";
import {
  SortableTableHead,
  type WebSourceSortBy,
} from "@/components/data-table";
import type { SortDirection } from "@/hooks/useServerTable";
import { useExportSource } from "@/hooks/use-export-source";
import { getSourceDisplayName } from "@/lib/crawler-metadata";
import { CrawlProgress } from "@/components/chatbot/web-sources/CrawlProgress";
import { CrawledPagesList } from "@/components/chatbot/web-sources/CrawledPagesList";
import { SourceStatusBadge } from "@/components/chatbot/web-sources/StatusBadges";
import { ConfirmDialogContent } from "@/components/chatbot/web-sources/ConfirmDialogContent";
import { ResponsiveTableShell } from "@/components/chatbot/web-sources/ResponsiveTableShell";
import { isActiveSource } from "@/components/chatbot/web-sources/utils";

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
  onStop: (sourceId: string) => void;
  onToggleEnabled: (sourceId: string, enabled: boolean) => void;
  onRename: (sourceId: string, name: string) => Promise<unknown>;
  isRecrawling: boolean;
  isDeleting: boolean;
  isStopping: boolean;
  isTogglingEnabled: boolean;
  isRenaming: boolean;
  sortBy: DashboardSortBy;
  sortDir: SortDirection;
  onSort: (column: DashboardSortBy) => void;
}

// A single button summarising attachment count; opens a checklist of chatbots.
// Scales to many chatbots (shows a count, not a row of badges).
function ChatbotAttachButton({
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
  const count = source.chatbots.length;
  const attachedNames = source.chatbots.map((c) => c.name).join(", ");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-36 justify-between"
          title={
            count > 0 ? `Attached to: ${attachedNames}` : "Attach to chatbots"
          }
        >
          <span className="flex items-center">
            {count > 0 ? (
              <>
                <Bot className="mr-1.5 h-3.5 w-3.5" />
                {count} chatbot{count !== 1 ? "s" : ""}
              </>
            ) : (
              <>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Attach
              </>
            )}
          </span>
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
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

function EnabledSwitch({
  source,
  onToggleEnabled,
  isTogglingEnabled,
}: {
  source: DashboardSource;
  onToggleEnabled: (sourceId: string, enabled: boolean) => void;
  isTogglingEnabled: boolean;
}) {
  return (
    <div
      title={
        source.enabled
          ? "Enabled — included in chat context. Toggle to disable."
          : "Disabled — kept but excluded from chat context. Toggle to enable."
      }
    >
      <Switch
        checked={source.enabled}
        onCheckedChange={(enabled) => onToggleEnabled(source.id, enabled)}
        disabled={isTogglingEnabled}
        aria-label={source.enabled ? "Disable source" : "Enable source"}
      />
    </div>
  );
}

// Expand chevron + overflow menu (recrawl, export, delete).
function SourceActions({
  source,
  isExpanded,
  onToggleExpand,
  onRecrawl,
  onDelete,
  onStop,
  isRecrawling,
  isDeleting,
  isStopping,
}: {
  source: DashboardSource;
  isExpanded: boolean;
  onToggleExpand: (sourceId: string) => void;
  onRecrawl: (sourceId: string) => void;
  onDelete: (sourceId: string) => void;
  onStop: (sourceId: string) => void;
  isRecrawling: boolean;
  isDeleting: boolean;
  isStopping: boolean;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmStop, setConfirmStop] = useState(false);
  const handleExport = useExportSource(source.id, source.rootUrl);
  const isActive = isActiveSource(source);

  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-foreground"
        onClick={() => onToggleExpand(source.id)}
        aria-label={isExpanded ? "Hide crawled pages" : "Show crawled pages"}
      >
        <ChevronDown
          className={`h-4 w-4 transition-transform ${
            isExpanded ? "rotate-180" : ""
          }`}
        />
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label="More actions"
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          {isActive && (
            <DropdownMenuItem
              disabled={isStopping}
              onSelect={(e) => {
                e.preventDefault();
                setConfirmStop(true);
              }}
            >
              <CircleStop className="mr-2 h-4 w-4" />
              Stop crawl
            </DropdownMenuItem>
          )}
          {(source.status === "completed" || source.status === "failed") && (
            <DropdownMenuItem
              disabled={isRecrawling}
              onClick={() => onRecrawl(source.id)}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              {source.status === "failed" ? "Retry" : "Re-crawl"}
            </DropdownMenuItem>
          )}
          {source.status === "completed" && (
            <DropdownMenuItem onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" />
              Export JSON
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={isDeleting}
            onSelect={(e) => {
              e.preventDefault();
              setConfirmDelete(true);
            }}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmStop} onOpenChange={setConfirmStop}>
        <ConfirmDialogContent
          title="Stop crawl"
          description="Stop this crawl now. Pages already crawled are kept; the rest are skipped. You can re-crawl or delete the source afterwards."
          cancelLabel="Keep crawling"
          confirmLabel="Stop crawl"
          onConfirm={() => onStop(source.id)}
        />
      </AlertDialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <ConfirmDialogContent
          title="Delete web source"
          description="Permanently delete this web source and all of its crawled pages. It will be detached from every chatbot. This cannot be undone."
          cancelLabel="Cancel"
          confirmLabel="Delete permanently"
          destructive
          onConfirm={() => onDelete(source.id)}
        />
      </AlertDialog>
    </div>
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
  onStop: (sourceId: string) => void;
  onToggleEnabled: (sourceId: string, enabled: boolean) => void;
  onRename: (sourceId: string, name: string) => Promise<unknown>;
  isRecrawling: boolean;
  isDeleting: boolean;
  isStopping: boolean;
  isTogglingEnabled: boolean;
  isRenaming: boolean;
}

function NameCell({
  source,
  isRenaming,
  onRename,
}: {
  source: DashboardSource;
  isRenaming: boolean;
  onRename: (sourceId: string, name: string) => Promise<unknown>;
}) {
  return (
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
  onStop,
  onToggleEnabled,
  onRename,
  isRecrawling,
  isDeleting,
  isStopping,
  isTogglingEnabled,
  isRenaming,
}: RowProps & { colSpan: number }) {
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
          <NameCell
            source={source}
            isRenaming={isRenaming}
            onRename={onRename}
          />
        </TableCell>
        <TableCell>
          <span className="text-sm whitespace-nowrap">
            {source.pageCount} page{source.pageCount !== 1 ? "s" : ""}
          </span>
        </TableCell>
        <TableCell>
          <SourceStatusBadge status={source.status} />
        </TableCell>
        <TableCell>
          <EnabledSwitch
            source={source}
            onToggleEnabled={onToggleEnabled}
            isTogglingEnabled={isTogglingEnabled}
          />
        </TableCell>
        <TableCell>
          <ChatbotAttachButton
            source={source}
            chatbots={chatbots}
            onAttach={onAttach}
            onDetach={onDetach}
            isPending={isAttaching}
          />
        </TableCell>
        <TableCell>
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {source.lastCrawledAt
              ? new Date(source.lastCrawledAt).toLocaleDateString()
              : "—"}
          </span>
        </TableCell>
        <TableCell className="text-right">
          <SourceActions
            source={source}
            isExpanded={isExpanded}
            onToggleExpand={onToggleExpand}
            onRecrawl={onRecrawl}
            onDelete={onDelete}
            onStop={onStop}
            isRecrawling={isRecrawling}
            isDeleting={isDeleting}
            isStopping={isStopping}
          />
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

function DashboardSourceCardMobile({
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
  onStop,
  onToggleEnabled,
  onRename,
  isRecrawling,
  isDeleting,
  isStopping,
  isTogglingEnabled,
  isRenaming,
}: RowProps) {
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
        <div className="min-w-0 flex-1">
          <NameCell
            source={source}
            isRenaming={isRenaming}
            onRename={onRename}
          />
        </div>
        <SourceActions
          source={source}
          isExpanded={isExpanded}
          onToggleExpand={onToggleExpand}
          onRecrawl={onRecrawl}
          onDelete={onDelete}
          onStop={onStop}
          isRecrawling={isRecrawling}
          isDeleting={isDeleting}
          isStopping={isStopping}
        />
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <SourceStatusBadge status={source.status} />
        <span className="bg-muted px-2 py-0.5 rounded text-xs text-muted-foreground">
          {source.pageCount} page{source.pageCount !== 1 ? "s" : ""}
        </span>
        {source.lastCrawledAt && (
          <span className="bg-muted px-2 py-0.5 rounded text-xs text-muted-foreground">
            Last: {new Date(source.lastCrawledAt).toLocaleDateString()}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <EnabledSwitch
            source={source}
            onToggleEnabled={onToggleEnabled}
            isTogglingEnabled={isTogglingEnabled}
          />
          {source.enabled ? "Enabled" : "Disabled"}
        </label>
        <ChatbotAttachButton
          source={source}
          chatbots={chatbots}
          onAttach={onAttach}
          onDetach={onDetach}
          isPending={isAttaching}
        />
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
  onStop,
  onToggleEnabled,
  onRename,
  isRecrawling,
  isDeleting,
  isStopping,
  isTogglingEnabled,
  isRenaming,
  sortBy,
  sortDir,
  onSort,
}: DashboardWebSourceTableProps) {
  // 8 columns: checkbox, name, pages, status, enabled, chatbots, last, actions
  const colSpan = 8;

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
    onStop,
    onToggleEnabled,
    onRename,
    isRecrawling,
    isDeleting,
    isStopping,
    isTogglingEnabled,
    isRenaming,
  });

  return (
    <ResponsiveTableShell
      selectAll={{
        checked: allSelected,
        onChange: onSelectAll,
        ariaLabel: "Select all web sources",
      }}
      desktop={
        <Table style={{ tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: "3%" }} />
            <col style={{ width: "26%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "11%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "17%" }} />
            <col style={{ width: "11%" }} />
            <col style={{ width: "11%" }} />
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
              <TableHead className="whitespace-nowrap">Enabled</TableHead>
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
      }
      mobile={sources.map((source) => (
        <DashboardSourceCardMobile key={source.id} {...rowProps(source)} />
      ))}
    />
  );
}
