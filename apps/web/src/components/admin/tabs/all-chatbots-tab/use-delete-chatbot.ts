"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

type DeleteDialogState = {
  isOpen: boolean;
  chatbotId: string | null;
  chatbotName: string | null;
  ownerName: string | null;
};

// Owns the delete-chatbot confirmation dialog state and tRPC mutation.
export function useDeleteChatbot({
  refetchChatbots,
}: {
  refetchChatbots: () => void;
}): {
  deleteChatbot: ReturnType<typeof trpc.admin.deleteChatbot.useMutation>;
  deleteChatbotDialog: DeleteDialogState;
  handleDeleteChatbot: (
    chatbotId: string,
    chatbotName: string,
    ownerName: string,
  ) => void;
  confirmDeleteChatbot: () => Promise<void>;
  closeDeleteDialog: () => void;
} {
  const [deleteChatbotDialog, setDeleteChatbotDialog] =
    useState<DeleteDialogState>({
      isOpen: false,
      chatbotId: null,
      chatbotName: null,
      ownerName: null,
    });

  const deleteChatbot: ReturnType<typeof trpc.admin.deleteChatbot.useMutation> =
    trpc.admin.deleteChatbot.useMutation({
      onSuccess: () => {
        refetchChatbots();
        toast.success("Chatbot deleted successfully", {
          description: "The chatbot and all associated data have been removed",
        });
      },
      onError: (error) => {
        toast.error("Failed to delete chatbot", {
          description: error.message,
        });
      },
    });

  const handleDeleteChatbot = (
    chatbotId: string,
    chatbotName: string,
    ownerName: string,
  ) => {
    setDeleteChatbotDialog({
      isOpen: true,
      chatbotId,
      chatbotName,
      ownerName,
    });
  };

  const confirmDeleteChatbot = async () => {
    if (!deleteChatbotDialog.chatbotId) return;
    await deleteChatbot.mutateAsync({
      chatbotId: deleteChatbotDialog.chatbotId,
    });
    setDeleteChatbotDialog({
      isOpen: false,
      chatbotId: null,
      chatbotName: null,
      ownerName: null,
    });
  };

  const closeDeleteDialog = () => {
    setDeleteChatbotDialog({
      isOpen: false,
      chatbotId: null,
      chatbotName: null,
      ownerName: null,
    });
  };

  return {
    deleteChatbot,
    deleteChatbotDialog,
    handleDeleteChatbot,
    confirmDeleteChatbot,
    closeDeleteDialog,
  };
}
