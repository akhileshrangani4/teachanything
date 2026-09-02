"use client";

import { Card, CardContent } from "@/components/ui/card";
import { FileTable } from "@/components/dashboard/files/FileTable";
import { PaginationControls } from "@/components/dashboard/files/PaginationControls";
import { TableToolbar, type FileSortBy } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import type { UseServerTableReturn } from "@/hooks/useServerTable";
import { Trash2 } from "lucide-react";

interface FilesTableSectionProps {
  table: UseServerTableReturn<FileSortBy>;
  files: React.ComponentProps<typeof FileTable>["files"];
  totalCount: number;
  totalPages: number;
  selectedFiles: Set<string>;
  allSelected: boolean;
  deletePending: boolean;
  retryPending: boolean;
  showInlineLoading: boolean;
  onToggleFile: (fileId: string) => void;
  onSelectAll: () => void;
  onDelete: (fileId: string) => void;
  onRetry: (fileId: string) => void;
  onDeleteSelected: () => void;
}

/** Search toolbar + file table + pagination for the files page. */
export function FilesTableSection({
  table,
  files,
  totalCount,
  totalPages,
  selectedFiles,
  allSelected,
  deletePending,
  retryPending,
  showInlineLoading,
  onToggleFile,
  onSelectAll,
  onDelete,
  onRetry,
  onDeleteSelected,
}: FilesTableSectionProps) {
  const { state, searchInput, actions } = table;

  return (
    <Card>
      <CardContent className="p-6">
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
            <TableToolbar
              searchValue={searchInput}
              onSearchChange={actions.setSearch}
              placeholder="Search files by name or type..."
              isLoading={showInlineLoading}
              className="mb-0 flex-1"
            />
            <div className="flex items-center gap-4 sm:ml-auto">
              {selectedFiles.size > 0 && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={onDeleteSelected}
                  disabled={deletePending}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Selected ({selectedFiles.size})
                </Button>
              )}
              <p className="text-sm text-muted-foreground whitespace-nowrap">
                Showing {files.length} of {totalCount} file
                {totalCount !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          {files.length === 0 && state.search ? (
            <div className="text-center py-8 text-muted-foreground">
              No files match your search
            </div>
          ) : (
            <>
              <FileTable
                files={files}
                showCheckbox
                selectedFiles={selectedFiles}
                onToggleSelect={onToggleFile}
                onSelectAll={onSelectAll}
                allSelected={allSelected}
                actionType="delete"
                onAction={onDelete}
                actionDisabled={deletePending}
                onRetry={onRetry}
                retryDisabled={retryPending}
                showCreatedDate
                sortBy={state.sortBy}
                sortDir={state.sortDir}
                onSort={actions.toggleSort}
              />
              {totalPages > 1 && (
                <div className="mt-4">
                  <PaginationControls
                    currentPage={state.page}
                    totalPages={totalPages}
                    onPageChange={actions.setPage}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
