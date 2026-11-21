"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useTranslation } from "react-i18next";

export function DeleteConversationsDialog({
  pendingIds,
  isPending,
  onClose,
  onConfirm,
}: {
  pendingIds: string[] | null;
  isPending: boolean;
  onClose: () => void;
  onConfirm: (conversationIds: string[]) => void;
}) {
  const { t } = useTranslation();
  return (
    <AlertDialog
      open={pendingIds !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t("conversations.deleteDialog.title", {
              count: pendingIds?.length ?? 0,
            })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t("conversations.deleteDialog.description", {
              count: pendingIds?.length ?? 0,
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>
            {t("common.actions.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={isPending}
            onClick={(e) => {
              e.preventDefault();
              if (pendingIds && pendingIds.length > 0) {
                onConfirm(pendingIds);
              }
            }}
          >
            {isPending
              ? t("conversations.deleteDialog.deleting")
              : t("common.actions.delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
