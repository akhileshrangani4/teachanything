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
            Delete {pendingIds?.length ?? 0} chat
            {(pendingIds?.length ?? 0) !== 1 ? "s" : ""}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes the selected student chat
            {(pendingIds?.length ?? 0) !== 1 ? "s" : ""} and all their messages.
            This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
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
            {isPending ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
