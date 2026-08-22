"use client";

import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";

interface FilesPageDialogsProps {
  deleteDialogOpen: boolean;
  onDeleteDialogOpenChange: (open: boolean) => void;
  filesToDelete: string[];
  onConfirmDeleteFiles: () => void;
  deletePending: boolean;
  retryDialogOpen: boolean;
  onRetryDialogOpenChange: (open: boolean) => void;
  onConfirmRetry: () => void;
  retryPending: boolean;
}

/** Delete + retry confirmation dialogs for the files page. */
export function FilesPageDialogs({
  deleteDialogOpen,
  onDeleteDialogOpenChange,
  filesToDelete,
  onConfirmDeleteFiles,
  deletePending,
  retryDialogOpen,
  onRetryDialogOpenChange,
  onConfirmRetry,
  retryPending,
}: FilesPageDialogsProps) {
  return (
    <>
      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={onDeleteDialogOpenChange}
        onConfirm={onConfirmDeleteFiles}
        title={
          filesToDelete.length === 1
            ? "Delete File"
            : `Delete ${filesToDelete.length} Files`
        }
        description={
          filesToDelete.length === 1
            ? "Are you sure you want to delete this file? This action cannot be undone and will remove it from all chatbots it's associated with."
            : `Are you sure you want to delete ${filesToDelete.length} files? This action cannot be undone and will remove them from all chatbots they're associated with.`
        }
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        loading={deletePending}
      />

      {/* Retry Confirmation Dialog */}
      <ConfirmationDialog
        open={retryDialogOpen}
        onOpenChange={onRetryDialogOpenChange}
        onConfirm={onConfirmRetry}
        title="Cancel and Restart Processing?"
        description="This file is currently being processed. Are you sure you want to cancel and restart from the beginning? All current progress will be lost."
        confirmText="Cancel and Restart"
        cancelText="Keep Processing"
        variant="default"
        loading={retryPending}
      />
    </>
  );
}
