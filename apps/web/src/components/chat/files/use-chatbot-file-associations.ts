"use client";

import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { logError } from "@/lib/logger";
import { useTranslation } from "react-i18next";
import { serverErrorMessage } from "@/lib/server-error-message";
import {
  fileAssociationErrorMessage,
  isFailedFileError,
} from "@/lib/stored-file-error";

const ITEMS_PER_PAGE = 10;

interface UseChatbotFileAssociationsArgs {
  chatbotId: string;
  onRefetch: () => void;
  refetchAssociatedFiles: () => Promise<{
    data?: { totalCount?: number } | undefined;
  }>;
  /** Page-adjust callback pieces from useServerTable (used after removals). */
  currentPage: number;
  setPage: (page: number) => void;
}

/**
 * Associate/disassociate mutations plus the sequential bulk add/remove
 * flows for the chatbot files tab. Toast copy and refetch order are part
 * of the UX contract — change with care.
 */
export function useChatbotFileAssociations({
  chatbotId,
  onRefetch,
  refetchAssociatedFiles,
  currentPage,
  setPage,
}: UseChatbotFileAssociationsArgs) {
  const { t, i18n } = useTranslation();
  const utils = trpc.useUtils();

  const associateFile = trpc.files.associateWithChatbot.useMutation({
    onSuccess: async () => {
      // Refetch associated files and invalidate library list so added file disappears from there
      await Promise.all([
        refetchAssociatedFiles(),
        utils.files.list.invalidate(),
      ]);
      onRefetch();
      toast.success(t("files.chatbot.toasts.added"));
    },
    onError: (error) => {
      toast.error(
        isFailedFileError(error)
          ? t("files.chatbot.toasts.cannotAdd")
          : t("files.chatbot.toasts.addFailed"),
        {
          description: fileAssociationErrorMessage(i18n, error),
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
      if (currentPage >= newTotalPages && newTotalPages > 0) {
        setPage(newTotalPages - 1);
      }

      toast.success(t("files.chatbot.toasts.removed"));
    },
    onError: (error) => {
      toast.error(t("files.chatbot.toasts.removeFailed"), {
        description: serverErrorMessage(t, error),
      });
    },
  });

  const handleAddFile = (fileId: string) => {
    associateFile.mutate({ fileId, chatbotId });
  };

  const handleAddFiles = async (fileIds: string[]) => {
    if (fileIds.length === 0) return;

    const toastId = toast.loading(
      t("files.chatbot.toasts.adding", { count: fileIds.length }),
      {
        description: t("files.chatbot.toasts.pleaseWait"),
      },
    );

    let successCount = 0;
    let errorCount = 0;

    // Process files sequentially to avoid overwhelming the server
    for (const fileId of fileIds) {
      try {
        await associateFile.mutateAsync({ fileId, chatbotId });
        successCount++;
      } catch (error) {
        errorCount++;
        const errorMessage =
          error instanceof Error
            ? fileAssociationErrorMessage(i18n, error)
            : t("common.status.unknownError");
        // Show individual error for failed files
        toast.error(t("files.chatbot.toasts.addFailed"), {
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
        t("files.chatbot.toasts.addedAll", { count: successCount }),
        {
          id: toastId,
        },
      );
    } else if (successCount > 0 && errorCount > 0) {
      toast.warning(
        t("files.chatbot.toasts.addedPartial", {
          succeeded: successCount,
          failed: errorCount,
        }),
        {
          id: toastId,
          description: t("files.chatbot.toasts.addedPartialDescription"),
          duration: 5000,
        },
      );
    } else {
      toast.error(t("files.chatbot.toasts.addFailedAll"), {
        id: toastId,
        description: t("files.chatbot.toasts.addFailedAllDescription"),
        duration: 5000,
      });
    }
  };

  const handleRemoveFile = (fileId: string) => {
    disassociateFile.mutate({ fileId, chatbotId });
  };

  const handleRemoveFiles = async (fileIds: string[]) => {
    // Process files sequentially to avoid overwhelming the server
    for (const fileId of fileIds) {
      try {
        await disassociateFile.mutateAsync({ fileId, chatbotId });
      } catch (error) {
        // Continue with other files even if one fails
        logError(error, `Failed to remove file ${fileId}`);
      }
    }
    // Refetch after all files are processed
    onRefetch();
    toast.success(
      t("files.chatbot.toasts.removedCount", { count: fileIds.length }),
    );
  };

  // Narrowed, explicitly-shaped return: tRPC mutation objects have
  // non-portable inferred types (TS2742) and callers only need pending
  // flags plus the handlers.
  return {
    isAddingFile: associateFile.isPending,
    isRemovingFile: disassociateFile.isPending,
    handleAddFile,
    handleAddFiles,
    handleRemoveFile,
    handleRemoveFiles,
  };
}
