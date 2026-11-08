"use client";

import { Card, CardContent } from "@/components/ui/card";
import { UploadFileDialog } from "@/components/dashboard/files/UploadFileDialog";
import { useTranslation } from "react-i18next";

interface UploadSectionProps {
  onSuccess: () => void;
  existingFiles: React.ComponentProps<typeof UploadFileDialog>["existingFiles"];
}

/** Upload card at the top of the files page. */
export function UploadSection({
  onSuccess,
  existingFiles,
}: UploadSectionProps) {
  const { t } = useTranslation();
  return (
    <Card className="border border-border/60 shadow-xs">
      <CardContent className="p-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
          <div>
            <h2 className="text-xl font-semibold">
              {t("files.page.uploadTitle")}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {t("files.page.uploadDescription")}
            </p>
          </div>
          <UploadFileDialog
            onSuccess={onSuccess}
            existingFiles={existingFiles}
          />
        </div>
      </CardContent>
    </Card>
  );
}
