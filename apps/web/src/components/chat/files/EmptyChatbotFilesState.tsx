"use client";

import { FileText } from "lucide-react";
import Link from "next/link";
import { QuickAddFilesSection } from "./QuickAddFilesSection";
import { useTranslation, Trans } from "react-i18next";

interface EmptyChatbotFilesStateProps {
  chatbotId: string;
  onAddFile: (fileId: string) => void;
  onAddFiles?: (fileIds: string[]) => void;
  isAdding?: boolean;
  onRefetch?: () => void;
}

export function EmptyChatbotFilesState({
  chatbotId,
  onAddFile,
  onAddFiles,
  isAdding = false,
  onRefetch,
}: EmptyChatbotFilesStateProps) {
  const { t } = useTranslation();
  return (
    <div className="text-center py-12">
      <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
      <p className="text-muted-foreground mb-4">
        {t("files.chatbot.emptyTitle")}
      </p>
      <p className="text-sm text-muted-foreground mb-4">
        <Trans
          i18nKey="files.chatbot.emptyDescription"
          components={{
            a: (
              <Link
                href="/dashboard/files"
                className="text-primary underline"
              />
            ),
          }}
        />
      </p>
      <QuickAddFilesSection
        chatbotId={chatbotId}
        onAddFile={onAddFile}
        onAddFiles={onAddFiles}
        isAdding={isAdding}
        onRefetch={onRefetch}
      />
    </div>
  );
}
