"use client";

import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SortableTableHead } from "@/components/data-table";
import type { SortDirection } from "@/hooks/useServerTable";
import { ResponsiveTableShell } from "@/components/chatbot/web-sources/ResponsiveTableShell";
import { DashboardTableRow } from "./dashboard-web-source-table/desktop-row";
import { DashboardSourceCardMobile } from "./dashboard-web-source-table/mobile-card";
import type {
  Chatbot,
  DashboardSortBy,
  DashboardSource,
  RowProps,
} from "./dashboard-web-source-table/types";

export type { DashboardSortBy } from "./dashboard-web-source-table/types";

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
