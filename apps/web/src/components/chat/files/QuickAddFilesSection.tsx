"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { FileTable } from "@/components/dashboard/files/FileTable";
import { PaginationControls } from "@/components/dashboard/files/PaginationControls";
import { TableToolbar, type FileSortBy } from "@/components/data-table";
import { useServerTable } from "@/hooks/useServerTable";
import { Skeleton } from "@/components/ui/skeleton";
import { useFilePolling } from "@/hooks/useFilePolling";
import { keepPreviousData } from "@tanstack/react-query";
import type { RouterOutputs } from "@/lib/trpc";

type FileData = RouterOutputs["files"]["list"]["files"][number];

const ITEMS_PER_PAGE = 10;

interface QuickAddFilesSectionProps {
  chatbotId: string;
  onAddFile: (fileId: string) => void;
  onAddFiles?: (fileIds: string[]) => void;
  isAdding?: boolean;
  onRefetch?: () => void;
}

export function QuickAddFilesSection({
  chatbotId,
  onAddFile,
  onAddFiles,
  isAdding = false,
  onRefetch,
}: QuickAddFilesSectionProps) {
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());

  const { state, searchInput, actions, queryParams } =
    useServerTable<FileSortBy>(
      { defaultSortBy: "createdAt", defaultSortDir: "desc" },
      ITEMS_PER_PAGE,
    );

  // Fetch paginated files, excluding files already associated with this chatbot
  const {
    data: filesData,
    isLoading: filesLoading,
    isFetching,
    refetch: refetchFiles,
  } = trpc.files.list.useQuery(
    {
      limit: ITEMS_PER_PAGE,
      currentChatbotId: chatbotId,
      ...queryParams,
    },
    {
      refetchInterval: useFilePolling(),
      placeholderData: keepPreviousData,
    },
  );

  const availableFiles = useMemo(
    () => filesData?.files || [],
    [filesData?.files],
  );
  const totalCount = filesData?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  // Automatically remove files from selection that are no longer available
  // (i.e., they were successfully added)
  useEffect(() => {
    setSelectedFiles((prev) => {
      const newSelected = new Set(prev);
      let changed = false;
      for (const fileId of prev) {
        if (!availableFiles.some((f: FileData) => f.id === fileId)) {
          newSelected.delete(fileId);
          changed = true;
        }
      }
      return changed ? newSelected : prev;
    });
  }, [availableFiles]);

  const handleToggleFile = (fileId: string) => {
    const newSelected = new Set(selectedFiles);
    if (newSelected.has(fileId)) {
      newSelected.delete(fileId);
    } else {
      newSelected.add(fileId);
    }
    setSelectedFiles(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedFiles.size === availableFiles.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(availableFiles.map((f: FileData) => f.id)));
    }
  };

  const handleAddSelected = async () => {
    if (selectedFiles.size === 0) return;

    const filesToAdd = Array.from(selectedFiles);

    if (onAddFiles) {
      await onAddFiles(filesToAdd);
    } else {
      // Fallback to individual adds
      for (const fileId of filesToAdd) {
        await new Promise<void>((resolve) => {
          onAddFile(fileId);
          // Small delay to avoid overwhelming the server
          setTimeout(resolve, 100);
        });
      }
    }

    // Refetch to update available files
    await refetchFiles();
    if (onRefetch) {
      await onRefetch();
    }

    // Clear selection after adding
    setSelectedFiles(new Set());
  };

  const allSelected =
    selectedFiles.size === availableFiles.length && availableFiles.length > 0;

  // Don't show if no files available at all (only when not searching)
  const isSearching = state.search || searchInput;
  if (totalCount === 0 && !isSearching) {
    return null;
  }

  return (
    <div className="mt-6">
      <p className="text-sm font-medium mb-4">
        Quick add files from your library:
      </p>

      <div className="flex items-center gap-4 mb-4">
        <TableToolbar
          searchValue={searchInput}
          onSearchChange={actions.setSearch}
          placeholder="Search files to add..."
          isLoading={isFetching && !filesLoading}
          className="mb-0 flex-1"
        />
        <div className="flex items-center gap-4 ml-auto">
          {selectedFiles.size > 0 && (
            <Button size="sm" onClick={handleAddSelected} disabled={isAdding}>
              <Plus className="h-4 w-4 mr-2" />
              Add Selected ({selectedFiles.size})
            </Button>
          )}
          <p className="text-sm text-muted-foreground whitespace-nowrap">
            Showing {availableFiles.length} available file
            {availableFiles.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {filesLoading && !filesData ? (
        <div>
          {/* Desktop skeleton */}
          <div className="hidden md:block space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-4 py-2 border-b border-border/50 last:border-0"
              >
                <Skeleton className="h-4 w-40 shrink-0" />
                <Skeleton className="h-4 w-14 shrink-0" />
                <Skeleton className="h-5 w-20 rounded-full shrink-0" />
                <Skeleton className="h-8 w-16 rounded-md shrink-0 ml-auto" />
              </div>
            ))}
          </div>
          {/* Mobile skeleton */}
          <div className="md:hidden space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="border border-border/60 rounded-lg p-3 space-y-2"
              >
                <Skeleton className="h-4 w-full max-w-[160px]" />
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-14 rounded-full" />
                  <Skeleton className="h-7 w-14 rounded-md ml-auto" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : availableFiles.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          {state.search || searchInput
            ? "No files match your search"
            : "No more files available to add."}
        </p>
      ) : (
        <>
          <FileTable
            files={availableFiles}
            showCheckbox
            selectedFiles={selectedFiles}
            onToggleSelect={handleToggleFile}
            onSelectAll={handleSelectAll}
            allSelected={allSelected}
            actionType="add"
            onAction={onAddFile}
            actionDisabled={isAdding}
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
  );
}
