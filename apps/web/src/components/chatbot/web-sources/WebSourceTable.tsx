"use client";

import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  SortableTableHead,
  type WebSourceSortBy,
} from "@/components/data-table";
import type { SortDirection } from "@/hooks/useServerTable";
import { ResponsiveTableShell } from "./ResponsiveTableShell";
import { WebSourceTableRow } from "./web-source-table/desktop-row";
import { WebSourceCardMobile } from "./web-source-table/mobile-card";
import type { CrawlSource } from "./web-source-table/types";

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
