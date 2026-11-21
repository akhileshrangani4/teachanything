"use client";

import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { UserDetailsDialog } from "../../components/UserDetailsDialog";
import type { UserDetailsDialogState } from "../../types/user-details";
import { type UserDialogState } from "./types";
import { SendEmailDialog, type SendEmailRequest } from "./send-email-dialog";

// Approve / reject confirmations, the send-email dialog, and the shared user
// details dialog.
export function PendingUsersDialogs({
  approveDialog,
  rejectDialog,
  sendEmailDialog,
  detailsDialog,
  onCloseApprove,
  onCloseReject,
  onCloseSendEmail,
  onCloseDetails,
  onConfirmApprove,
  onConfirmReject,
  onConfirmSendEmail,
  isApproving,
  isRejecting,
  isSendingEmail,
}: {
  approveDialog: UserDialogState;
  rejectDialog: UserDialogState;
  sendEmailDialog: UserDialogState;
  detailsDialog: UserDetailsDialogState;
  onCloseApprove: () => void;
  onCloseReject: () => void;
  onCloseSendEmail: () => void;
  onCloseDetails: () => void;
  onConfirmApprove: () => void;
  onConfirmReject: () => void;
  onConfirmSendEmail: (request: SendEmailRequest) => void;
  isApproving: boolean;
  isRejecting: boolean;
  isSendingEmail: boolean;
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

      <SendEmailDialog
        dialog={sendEmailDialog}
        onClose={onCloseSendEmail}
        onSend={onConfirmSendEmail}
        isSending={isSendingEmail}
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
