"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { EMPTY_USER_DIALOG, type UserDialogState } from "./types";
import type { SendEmailRequest } from "./send-email-dialog";

const ITEMS_PER_PAGE = 10;

// Owns the approve/reject/send-email dialog state and their tRPC mutations.
export function usePendingUsersActions({
  totalCount,
  currentPage,
  setPage,
  refetchUsers,
  refetchStats,
}: {
  totalCount: number;
  currentPage: number;
  setPage: (page: number) => void;
  refetchUsers: () => void;
  refetchStats: () => void;
}) {
  const [approveDialog, setApproveDialog] =
    useState<UserDialogState>(EMPTY_USER_DIALOG);

  const [rejectDialog, setRejectDialog] =
    useState<UserDialogState>(EMPTY_USER_DIALOG);

  const [sendEmailDialog, setSendEmailDialog] =
    useState<UserDialogState>(EMPTY_USER_DIALOG);

  const sendRegistrationEmail = trpc.admin.sendRegistrationEmail.useMutation({
    onSuccess: () => {
      setSendEmailDialog(EMPTY_USER_DIALOG);
      toast.success("Email queued", {
        description: "The user will receive it shortly.",
      });
    },
    onError: (error) => {
      toast.error("Failed to send email", {
        description: error.message,
      });
    },
  });

  const approveUser = trpc.admin.approveUser.useMutation({
    onSuccess: () => {
      // If we're on the last page and it becomes empty after approval, go to previous page
      const newTotalCount = totalCount - 1;
      const newTotalPages = Math.ceil(newTotalCount / ITEMS_PER_PAGE);
      if (currentPage >= newTotalPages && currentPage > 0) {
        setPage(newTotalPages - 1);
      }
      refetchUsers();
      refetchStats();
      toast.success("User approved successfully", {
        description: "The user has been notified via email",
      });
    },
    onError: (error) => {
      toast.error("Failed to approve user", {
        description: error.message,
      });
    },
  });

  const rejectUser = trpc.admin.rejectUser.useMutation({
    onSuccess: () => {
      // If we're on the last page and it becomes empty after rejection, go to previous page
      const newTotalCount = totalCount - 1;
      const newTotalPages = Math.ceil(newTotalCount / ITEMS_PER_PAGE);
      if (currentPage >= newTotalPages && currentPage > 0) {
        setPage(newTotalPages - 1);
      }
      refetchUsers();
      refetchStats();
      toast.success("User rejected", {
        description: "The user has been notified via email",
      });
    },
    onError: (error) => {
      toast.error("Failed to reject user", {
        description: error.message,
      });
    },
  });

  const handleApprove = (
    userId: string,
    userName: string,
    userEmail: string,
  ) => {
    setApproveDialog({
      isOpen: true,
      userId,
      userName,
      userEmail,
    });
  };

  const handleReject = (
    userId: string,
    userName: string,
    userEmail: string,
  ) => {
    setRejectDialog({
      isOpen: true,
      userId,
      userName,
      userEmail,
    });
  };

  const handleSendEmail = (
    userId: string,
    userName: string,
    userEmail: string,
  ) => {
    setSendEmailDialog({
      isOpen: true,
      userId,
      userName,
      userEmail,
    });
  };

  const confirmSendEmail = (request: SendEmailRequest) => {
    if (!sendEmailDialog.userId) return;
    sendRegistrationEmail.mutate({
      userId: sendEmailDialog.userId,
      ...request,
    });
  };

  const confirmApprove = async () => {
    if (!approveDialog.userId) return;
    await approveUser.mutateAsync({ userId: approveDialog.userId });
    setApproveDialog(EMPTY_USER_DIALOG);
  };

  const confirmReject = async () => {
    if (!rejectDialog.userId) return;
    await rejectUser.mutateAsync({ userId: rejectDialog.userId });
    setRejectDialog(EMPTY_USER_DIALOG);
  };

  return {
    approveDialog,
    setApproveDialog,
    rejectDialog,
    setRejectDialog,
    sendEmailDialog,
    setSendEmailDialog,
    isApproving: approveUser.isPending,
    isRejecting: rejectUser.isPending,
    isSendingEmail: sendRegistrationEmail.isPending,
    approveError: approveUser.error,
    rejectError: rejectUser.error,
    handleApprove,
    handleReject,
    handleSendEmail,
    confirmApprove,
    confirmReject,
    confirmSendEmail,
  };
}
