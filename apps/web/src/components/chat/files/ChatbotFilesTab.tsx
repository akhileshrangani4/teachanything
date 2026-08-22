"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import Link from "next/link";
import { FileTable } from "@/components/dashboard/files/FileTable";
import { EmptyChatbotFilesState } from "./EmptyChatbotFilesState";
import { QuickAddFilesSection } from "./QuickAddFilesSection";
import { PaginationControls } from "@/components/dashboard/files/PaginationControls";
import { TableToolbar, type FileSortBy } from "@/components/data-table";
import { useServerTable } from "@/hooks/useServerTable";
import { X } from "lucide-react";
import { FileTableSkeleton } from "@/components/ui/skeletons";
import { getFilePollingInterval } from "@/hooks/file-polling";
import { keepPreviousData } from "@tanstack/react-query";
import { useChatbotFileAssociations } from "./use-chatbot-file-associations";

const ITEMS_PER_PAGE = 10;

interface ChatbotFilesTabProps {
  chatbotId: string;
  filesLoading: boolean;
  onRefetch: () => void;
}

export function ChatbotFilesTab({
  chatbotId,
  filesLoading,
  onRefetch,
}: ChatbotFilesTabProps) {
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());

  const { state, searchInput, actions, queryParams } =
    useServerTable<FileSortBy>(
      { defaultSortBy: "createdAt", defaultSortDir: "desc" },
      ITEMS_PER_PAGE,
    );

  // Fetch paginated associated files
  const {
    data: associatedFilesData,
    isLoading: associatedFilesLoading,
    isFetching,
    refetch: refetchAssociatedFiles,
  } = trpc.files.listForChatbot.useQuery(
    {
      chatbotId,
      limit: ITEMS_PER_PAGE,
      ...queryParams,
    },
    {
      enabled: !!chatbotId,
      refetchInterval: getFilePollingInterval(),
      placeholderData: keepPreviousData,
    },
  );

  const associatedFiles = useMemo(
    () => associatedFilesData?.files || [],
    [associatedFilesData?.files],
  );
  const associatedFilesTotalCount = associatedFilesData?.totalCount || 0;
  const associatedFilesTotalPages = Math.ceil(
    associatedFilesTotalCount / ITEMS_PER_PAGE,
  );

  // Automatically remove files from selection that are no longer associated
  useEffect(() => {
    if (associatedFiles.length > 0) {
      setSelectedFiles((prev) => {
        const newSelected = new Set(prev);
        let changed = false;
        for (const fileId of prev) {
          if (!associatedFiles.some((f: { id: string }) => f.id === fileId)) {
            newSelected.delete(fileId);
            changed = true;
          }
        }
        return changed ? newSelected : prev;
      });
    }
  }, [associatedFiles]);

  const {
    isAddingFile,
    isRemovingFile,
    handleAddFile,
    handleAddFiles,
    handleRemoveFile,
    handleRemoveFiles: removeFiles,
  } = useChatbotFileAssociations({
    chatbotId,
    onRefetch,
    refetchAssociatedFiles,
    currentPage: state.page,
    setPage: actions.setPage,
  });

  const handleRemoveFiles = async (fileIds: string[]) => {
    await removeFiles(fileIds);
    setSelectedFiles(new Set());
  };

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
    if (!associatedFiles || associatedFiles.length === 0) return;
    if (selectedFiles.size === associatedFiles.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(associatedFiles.map((f) => f.id)));
    }
  };

  const allSelected =
    selectedFiles.size === associatedFiles.length && associatedFiles.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Associated Files</CardTitle>
        <CardDescription>
          Files that provide context for this chatbot. Manage files from the{" "}
          <Link href="/dashboard/files" className="text-primary underline">
            Files page
          </Link>
          .
        </CardDescription>
      </CardHeader>
      <CardContent>
        {(filesLoading || associatedFilesLoading) && !associatedFilesData ? (
          <FileTableSkeleton />
        ) : associatedFiles.length === 0 && !state.search && !searchInput ? (
          // Truly empty state - no files and not searching
          <EmptyChatbotFilesState
            chatbotId={chatbotId}
            onAddFile={handleAddFile}
            onAddFiles={handleAddFiles}
            isAdding={isAddingFile}
            onRefetch={refetchAssociatedFiles}
          />
        ) : (
          // Has files OR is searching - show toolbar and table structure
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center gap-4 mb-4">
                <TableToolbar
                  searchValue={searchInput}
                  onSearchChange={actions.setSearch}
                  placeholder="Search associated files..."
                  isLoading={isFetching && !associatedFilesLoading}
                  className="mb-0 flex-1"
                />
                <div className="flex items-center gap-4 ml-auto">
                  {selectedFiles.size > 0 && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() =>
                        handleRemoveFiles(Array.from(selectedFiles))
                      }
                      disabled={isRemovingFile}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Remove Selected ({selectedFiles.size})
                    </Button>
                  )}
                  <p className="text-sm text-muted-foreground whitespace-nowrap">
                    Showing {associatedFiles.length} of{" "}
                    {associatedFilesTotalCount} file
                    {associatedFilesTotalCount !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
              {associatedFiles.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No files match your search
                </div>
              ) : (
                <>
                  <FileTable
                    files={associatedFiles}
                    showCheckbox
                    selectedFiles={selectedFiles}
                    onToggleSelect={handleToggleFile}
                    onSelectAll={handleSelectAll}
                    allSelected={allSelected}
                    actionType="remove"
                    onAction={handleRemoveFile}
                    actionDisabled={isRemovingFile}
                    sortBy={state.sortBy}
                    sortDir={state.sortDir}
                    onSort={actions.toggleSort}
                  />
                  {associatedFilesTotalPages > 1 && (
                    <div className="mt-4">
                      <PaginationControls
                        currentPage={state.page}
                        totalPages={associatedFilesTotalPages}
                        onPageChange={actions.setPage}
                      />
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Show QuickAddFilesSection when we have files or are searching */}
            <QuickAddFilesSection
              chatbotId={chatbotId}
              onAddFile={handleAddFile}
              onAddFiles={handleAddFiles}
              isAdding={isAddingFile}
              onRefetch={refetchAssociatedFiles}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
