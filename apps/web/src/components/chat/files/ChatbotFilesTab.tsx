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
import { toast } from "sonner";
import Link from "next/link";
import { FileTable } from "@/components/dashboard/files/FileTable";
import { EmptyChatbotFilesState } from "./EmptyChatbotFilesState";
import { QuickAddFilesSection } from "./QuickAddFilesSection";
import { PaginationControls } from "@/components/dashboard/files/PaginationControls";
import { TableToolbar, type FileSortBy } from "@/components/data-table";
import { useServerTable } from "@/hooks/useServerTable";
import { X } from "lucide-react";
import { FileTableSkeleton } from "@/components/ui/skeletons";
import { useFilePolling } from "@/hooks/useFilePolling";
import { keepPreviousData } from "@tanstack/react-query";

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
  const utils = trpc.useUtils();

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
      refetchInterval: useFilePolling(),
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

  // Associate/disassociate file mutations
  const associateFile = trpc.files.associateWithChatbot.useMutation({
    onSuccess: async () => {
      // Refetch associated files and invalidate library list so added file disappears from there
      await Promise.all([
        refetchAssociatedFiles(),
        utils.files.list.invalidate(),
      ]);
      onRefetch();
      toast.success("File added to chatbot");
    },
    onError: (error) => {
      // Check if it's a failed file error
      const isFailedFileError = error.message.includes("failed to process");
      toast.error(
        isFailedFileError ? "Cannot add file" : "Failed to add file",
        {
          description: error.message,
          duration: 5000,
        },
      );
    },
  });

  const disassociateFile = trpc.files.disassociateFromChatbot.useMutation({
    onSuccess: async () => {
      // Refetch associated files and invalidate library list so removed file appears there
      const [result] = await Promise.all([
        refetchAssociatedFiles(),
        utils.files.list.invalidate(),
      ]);
      onRefetch();

      // Adjust page if current page no longer exists
      const newTotalCount = result.data?.totalCount || 0;
      const newTotalPages = Math.ceil(newTotalCount / ITEMS_PER_PAGE);
      if (state.page >= newTotalPages && newTotalPages > 0) {
        actions.setPage(newTotalPages - 1);
      }

      toast.success("File removed from chatbot");
    },
    onError: (error) => {
      toast.error("Failed to remove file", {
        description: error.message,
      });
    },
  });

  const handleAddFile = (fileId: string) => {
    associateFile.mutate({
      fileId,
      chatbotId,
    });
  };

  const handleAddFiles = async (fileIds: string[]) => {
    if (fileIds.length === 0) return;

    const toastId = toast.loading(
      `Adding ${fileIds.length} file${fileIds.length !== 1 ? "s" : ""}...`,
      {
        description: "Please wait",
      },
    );

    let successCount = 0;
    let errorCount = 0;
    const errors: Array<{ fileId: string; message: string }> = [];

    // Process files sequentially to avoid overwhelming the server
    for (const fileId of fileIds) {
      try {
        await associateFile.mutateAsync({
          fileId,
          chatbotId,
        });
        successCount++;
      } catch (error) {
        errorCount++;
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        errors.push({ fileId, message: errorMessage });
        // Show individual error for failed files
        toast.error("Failed to add file", {
          description: errorMessage,
          duration: 3000,
        });
      }
    }

    // Refetch after all files are processed
    await refetchAssociatedFiles();
    onRefetch();

    // Show summary toast
    if (successCount > 0 && errorCount === 0) {
      toast.success(
        `Successfully added ${successCount} file${successCount !== 1 ? "s" : ""} to chatbot`,
        {
          id: toastId,
        },
      );
    } else if (successCount > 0 && errorCount > 0) {
      toast.warning(
        `Added ${successCount} file${successCount !== 1 ? "s" : ""}, ${errorCount} failed`,
        {
          id: toastId,
          description:
            "Some files could not be added. Check individual error messages above.",
          duration: 5000,
        },
      );
    } else {
      toast.error("Failed to add files", {
        id: toastId,
        description:
          "None of the selected files could be added. Check error messages above.",
        duration: 5000,
      });
    }
  };

  const handleRemoveFile = (fileId: string) => {
    disassociateFile.mutate({
      fileId,
      chatbotId,
    });
  };

  const handleRemoveFiles = async (fileIds: string[]) => {
    // Process files sequentially to avoid overwhelming the server
    for (const fileId of fileIds) {
      try {
        await disassociateFile.mutateAsync({
          fileId,
          chatbotId,
        });
      } catch (error) {
        // Continue with other files even if one fails
        console.error(`Failed to remove file ${fileId}:`, error);
      }
    }
    // Refetch after all files are processed
    onRefetch();
    toast.success(
      `${fileIds.length} file${fileIds.length !== 1 ? "s" : ""} removed from chatbot`,
    );
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
            isAdding={associateFile.isPending}
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
                      disabled={disassociateFile.isPending}
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
                    actionDisabled={disassociateFile.isPending}
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
              isAdding={associateFile.isPending}
              onRefetch={refetchAssociatedFiles}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
