"use client";

import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();
  return (
    <>
      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={onDeleteDialogOpenChange}
        onConfirm={onConfirmDeleteFiles}
        title={t("files.deleteDialog.title", { count: filesToDelete.length })}
        description={t("files.deleteDialog.description", {
          count: filesToDelete.length,
        })}
        confirmText={t("common.actions.delete")}
        cancelText={t("common.actions.cancel")}
        variant="destructive"
        loading={deletePending}
      />

      {/* Retry Confirmation Dialog */}
      <ConfirmationDialog
        open={retryDialogOpen}
        onOpenChange={onRetryDialogOpenChange}
        onConfirm={onConfirmRetry}
        title={t("files.retryDialog.title")}
        description={t("files.retryDialog.description")}
        confirmText={t("files.retryDialog.confirm")}
        cancelText={t("files.retryDialog.keepProcessing")}
        variant="default"
        loading={retryPending}
      />
    </>
  );
}
