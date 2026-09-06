"use client";

import { Card, CardContent } from "@/components/ui/card";
import { UploadFileDialog } from "@/components/dashboard/files/UploadFileDialog";

interface UploadSectionProps {
  onSuccess: () => void;
  existingFiles: React.ComponentProps<typeof UploadFileDialog>["existingFiles"];
}

/** Upload card at the top of the files page. */
export function UploadSection({
  onSuccess,
  existingFiles,
}: UploadSectionProps) {
  return (
    <Card className="border border-border/60 shadow-xs">
      <CardContent className="p-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
          <div>
            <h2 className="text-xl font-semibold">Upload Files</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Upload files to your centralized library. You can then associate
              them with any chatbot.
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
