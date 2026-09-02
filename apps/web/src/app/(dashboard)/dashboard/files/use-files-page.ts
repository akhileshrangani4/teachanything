"use client";

import { trpc } from "@/lib/trpc";
import { getFilePollingInterval } from "@/hooks/file-polling";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import type { FileSortBy } from "@/components/data-table";
import { useServerTable } from "@/hooks/useServerTable";
import { keepPreviousData } from "@tanstack/react-query";

const ITEMS_PER_PAGE = 10;

/**
 * Owns all stateful behavior for the files dashboard: table state, the
 * paginated files query with polling, delete/retry mutations, selection,
 * and the batch-delete + retry-confirm flows (toast copy preserved).
 */
export function useFilesPage() {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [filesToDelete, setFilesToDelete] = useState<string[]>([]);
  const [retryDialogOpen, setRetryDialogOpen] = useState(false);
  const [fileToRetry, setFileToRetry] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());

  const table = useServerTable<FileSortBy>(
    { defaultSortBy: "createdAt", defaultSortDir: "desc" },
    ITEMS_PER_PAGE,
  );
  const { state, searchInput, actions, queryParams } = table;

  // Get all user files (centralized)
  // Automatically polls for status updates when files are processing
  const {
    data: filesData,
    isLoading: filesLoading,
    isFetching,
    refetch,
  } = trpc.files.list.useQuery(
    {
      limit: ITEMS_PER_PAGE,
      ...queryParams,
    },
    {
      refetchInterval: getFilePollingInterval(),
      placeholderData: keepPreviousData,
    },
  );

  const files = useMemo(() => filesData?.files || [], [filesData?.files]);
  const totalCount = filesData?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  // Check if all files on current page are selected
  const allSelected = useMemo(() => {
    return (
      files.length > 0 && files.every((file) => selectedFiles.has(file.id))
    );
  }, [files, selectedFiles]);

  // Delete file mutation
  const deleteFile = trpc.files.delete.useMutation({
    onSuccess: async () => {
      // Refetch to get updated count
      const result = await refetch();
      const newTotalCount = result.data?.totalCount || 0;
      const newTotalPages = Math.ceil(newTotalCount / ITEMS_PER_PAGE);

      // If we're on a page that no longer exists, go back to the last valid page
      if (state.page >= newTotalPages && newTotalPages > 0) {
        actions.setPage(newTotalPages - 1);
      }

      // Clear selection after deletion
      setSelectedFiles(new Set());
    },
    onError: (error) => {
      toast.error("Failed to delete file", {
        description: error.message,
      });
    },
  });

  // Retry file mutation
  const retryFile = trpc.files.retry.useMutation({
    onSuccess: (_, variables) => {
      const file = files.find((f) => f.id === variables.fileId);
      const wasProcessing =
        file?.processingStatus === "processing" &&
        file?.metadata?.processingProgress?.lastUpdatedAt &&
        Date.now() -
          new Date(file.metadata.processingProgress.lastUpdatedAt).getTime() <
          30 * 60 * 1000;

      toast.success(
        wasProcessing
          ? "Processing cancelled and restarted"
          : "File processing restarted",
        {
          description: wasProcessing
            ? "The file will be processed again from the beginning"
            : "The file will be processed again",
        },
      );
      refetch();
    },
    onError: (error) => {
      toast.error("Failed to retry file", {
        description: error.message,
      });
    },
  });

  const handleDeleteFiles = async () => {
    if (filesToDelete.length === 0) return;

    const toastId = toast.loading(
      `Deleting ${filesToDelete.length} file${filesToDelete.length !== 1 ? "s" : ""}...`,
    );

    let successCount = 0;
    let errorCount = 0;

    // Delete files sequentially to avoid overwhelming the server
    for (const fileId of filesToDelete) {
      try {
        await deleteFile.mutateAsync({ fileId });
        successCount++;
      } catch {
        errorCount++;
      }
    }

    setDeleteDialogOpen(false);
    setFilesToDelete([]);
    setSelectedFiles(new Set());

    // Show summary toast
    if (successCount > 0 && errorCount === 0) {
      toast.success(
        `Successfully deleted ${successCount} file${successCount !== 1 ? "s" : ""}`,
        {
          id: toastId,
        },
      );
    } else if (successCount > 0 && errorCount > 0) {
      toast.warning(
        `Deleted ${successCount} file${successCount !== 1 ? "s" : ""}, ${errorCount} failed`,
        {
          id: toastId,
        },
      );
    } else {
      toast.error("Failed to delete files", {
        id: toastId,
        description: "Please try again",
      });
    }
  };

  const handleDelete = (fileId: string) => {
    setFilesToDelete([fileId]);
    setDeleteDialogOpen(true);
  };

  const handleRetry = (fileId: string) => {
    const file = files.find((f) => f.id === fileId);
    const isActivelyProcessing =
      file?.processingStatus === "processing" &&
      file?.metadata?.processingProgress?.lastUpdatedAt &&
      Date.now() -
        new Date(file.metadata.processingProgress.lastUpdatedAt).getTime() <
        30 * 60 * 1000;

    // Show confirmation for actively processing files
    if (isActivelyProcessing) {
      setFileToRetry(fileId);
      setRetryDialogOpen(true);
    } else {
      retryFile.mutate({ fileId });
    }
  };

  const confirmRetry = () => {
    if (fileToRetry) {
      retryFile.mutate({ fileId: fileToRetry });
      setRetryDialogOpen(false);
      setFileToRetry(null);
    }
  };

  const handleDeleteSelected = () => {
    if (selectedFiles.size === 0) return;
    setFilesToDelete(Array.from(selectedFiles));
    setDeleteDialogOpen(true);
  };

  const handleToggleFile = (fileId: string) => {
    setSelectedFiles((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(fileId)) {
        newSet.delete(fileId);
      } else {
        newSet.add(fileId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (allSelected) {
      // Deselect all files on current page
      setSelectedFiles((prev) => {
        const newSet = new Set(prev);
        files.forEach((file) => newSet.delete(file.id));
        return newSet;
      });
    } else {
      // Select all files on current page
      setSelectedFiles((prev) => {
        const newSet = new Set(prev);
        files.forEach((file) => newSet.add(file.id));
        return newSet;
      });
    }
  };

  // Show full loading only on initial load (no data yet)
  const showFullLoading = filesLoading && !filesData;
  // Show inline loading indicator when fetching but have data
  const showInlineLoading = isFetching && !filesLoading;

  // Narrowed surface for consumers: booleans + stable callbacks keep the
  // hook's inferred return type portable (no tRPC internals leak out).
  const refreshFiles = () => {
    void refetch();
  };

  return {
    table,
    state,
    searchInput,
    actions,
    files,
    totalCount,
    totalPages,
    allSelected,
    selectedFiles,
    deletePending: deleteFile.isPending,
    retryPending: retryFile.isPending,
    refreshFiles,
    showFullLoading,
    showInlineLoading,
    deleteDialogOpen,
    setDeleteDialogOpen,
    filesToDelete,
    retryDialogOpen,
    setRetryDialogOpen,
    fileToRetry,
    setFileToRetry,
    handleDeleteFiles,
    handleDelete,
    handleRetry,
    confirmRetry,
    handleDeleteSelected,
    handleToggleFile,
    handleSelectAll,
  };
}

export type FilesPageController = ReturnType<typeof useFilesPage>;
