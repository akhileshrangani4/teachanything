"use client";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PaginationControls } from "@/components/dashboard/files/PaginationControls";
import { TableToolbar } from "@/components/data-table";
import {
  DashboardWebSourceTable,
  type DashboardSortBy,
} from "@/components/dashboard/web-sources/DashboardWebSourceTable";
import { X } from "lucide-react";
import { STATUS_OPTIONS, type StatusFilter } from "./status-filter";

interface WebSourcesListProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  statusFilter: StatusFilter;
  onStatusChange: (value: StatusFilter) => void;
  showInlineLoading: boolean;
  sources: React.ComponentProps<typeof DashboardWebSourceTable>["sources"];
  chatbots: React.ComponentProps<typeof DashboardWebSourceTable>["chatbots"];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  selectedSources: Set<string>;
  expandedSources: Set<string>;
  allSelected: boolean;
  deletePending: boolean;
  onDeleteSelected: () => void;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onToggleExpand: (id: string) => void;
  onAttach: (crawlSourceId: string, chatbotId: string) => void;
  onDetach: (crawlSourceId: string, chatbotId: string) => void;
  isAttaching: boolean;
  onRecrawl: (crawlSourceId: string) => void;
  onDelete: (crawlSourceId: string) => void;
  onStop: (crawlSourceId: string) => void;
  onToggleEnabled: (crawlSourceId: string, enabled: boolean) => void;
  onRename: (crawlSourceId: string, name: string) => Promise<unknown>;
  isRecrawling: boolean;
  isDeleting: boolean;
  isStopping: boolean;
  isTogglingEnabled: boolean;
  isRenaming: boolean;
  sortBy: DashboardSortBy;
  sortDir: React.ComponentProps<typeof DashboardWebSourceTable>["sortDir"];
  onSort: React.ComponentProps<typeof DashboardWebSourceTable>["onSort"];
}

/** Search/status toolbar + source table + pagination for the dashboard. */
export function WebSourcesList({
  searchValue,
  onSearchChange,
  statusFilter,
  onStatusChange,
  showInlineLoading,
  sources,
  chatbots,
  totalCount,
  totalPages,
  currentPage,
  onPageChange,
  selectedSources,
  expandedSources,
  allSelected,
  deletePending,
  onDeleteSelected,
  onToggleSelect,
  onSelectAll,
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
}: WebSourcesListProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <TableToolbar
          searchValue={searchValue}
          onSearchChange={onSearchChange}
          placeholder="Search web sources..."
          isLoading={showInlineLoading}
          className="mb-0 flex-1"
        />
        <Select value={statusFilter} onValueChange={onStatusChange}>
          <SelectTrigger className="sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-4 sm:ml-auto">
          {selectedSources.size > 0 && (
            <Button
              size="sm"
              variant="destructive"
              onClick={onDeleteSelected}
              disabled={deletePending}
            >
              <X className="h-4 w-4 mr-2" />
              Delete Selected ({selectedSources.size})
            </Button>
          )}
          <p className="text-sm text-muted-foreground whitespace-nowrap">
            Showing {sources.length} of {totalCount} source
            {totalCount !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {sources.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          No web sources match your filters.
        </div>
      ) : (
        <>
          <DashboardWebSourceTable
            sources={sources}
            chatbots={chatbots}
            selectedSources={selectedSources}
            onToggleSelect={onToggleSelect}
            onSelectAll={onSelectAll}
            allSelected={allSelected}
            expandedSources={expandedSources}
            onToggleExpand={onToggleExpand}
            onAttach={onAttach}
            onDetach={onDetach}
            isAttaching={isAttaching}
            onRecrawl={onRecrawl}
            onDelete={onDelete}
            onStop={onStop}
            onToggleEnabled={onToggleEnabled}
            onRename={onRename}
            isRecrawling={isRecrawling}
            isDeleting={isDeleting}
            isStopping={isStopping}
            isTogglingEnabled={isTogglingEnabled}
            isRenaming={isRenaming}
            sortBy={sortBy}
            sortDir={sortDir}
            onSort={onSort}
          />
          {totalPages > 1 && (
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={onPageChange}
            />
          )}
        </>
      )}
    </div>
  );
}
