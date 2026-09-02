"use client";

import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { UserDetailsDialog } from "../../components/UserDetailsDialog";
import type { UserDetailsDialogState } from "../../types/user-details";
import { type UserDialogState } from "./types";

// Approve / reject confirmations plus the shared user details dialog.
export function PendingUsersDialogs({
  approveDialog,
  rejectDialog,
  detailsDialog,
  onCloseApprove,
  onCloseReject,
  onCloseDetails,
  onConfirmApprove,
  onConfirmReject,
  isApproving,
  isRejecting,
}: {
  approveDialog: UserDialogState;
  rejectDialog: UserDialogState;
  detailsDialog: UserDetailsDialogState;
  onCloseApprove: () => void;
  onCloseReject: () => void;
  onCloseDetails: () => void;
  onConfirmApprove: () => void;
  onConfirmReject: () => void;
  isApproving: boolean;
  isRejecting: boolean;
}) {
  return (
    <>
      {/* Approval Confirmation Dialog */}
      <ConfirmationDialog
        open={approveDialog.isOpen}
        onOpenChange={(open) => !open && onCloseApprove()}
        onConfirm={onConfirmApprove}
        title="Approve User"
        description={
          <>
            Are you sure you want to approve{" "}
            <strong>{approveDialog.userName}</strong> ({approveDialog.userEmail}
            )? They will be notified via email and granted access to the system.
          </>
        }
        confirmText="Approve"
        variant="default"
        loading={isApproving}
      />

      {/* Rejection Confirmation Dialog */}
      <ConfirmationDialog
        open={rejectDialog.isOpen}
        onOpenChange={(open) => !open && onCloseReject()}
        onConfirm={onConfirmReject}
        title="Reject User"
        description={
          <>
            Are you sure you want to reject{" "}
            <strong>{rejectDialog.userName}</strong> ({rejectDialog.userEmail})?
            They will be notified via email and will not be able to access the
            system.
          </>
        }
        confirmText="Reject"
        variant="destructive"
        loading={isRejecting}
      />

      {/* User Details Dialog */}
      <UserDetailsDialog
        open={detailsDialog.isOpen}
        onOpenChange={(open) => !open && onCloseDetails()}
        user={detailsDialog.user}
      />
    </>
  );
}
