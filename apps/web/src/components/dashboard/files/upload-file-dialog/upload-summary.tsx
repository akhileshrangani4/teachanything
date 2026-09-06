"use client";

import { formatFileSize } from "../file-constants";
import type { FileUploadState } from "./use-upload-queue";

// Total count/size summary shown under the drop zone while uploading.
export function UploadSummary({
  selectedFiles,
}: {
  selectedFiles: FileUploadState[];
}) {
  return (
    <div className="rounded-lg bg-muted/50 p-3 space-y-2 flex-shrink-0">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Total files:</span>
        <span className="font-medium">{selectedFiles.length}</span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Total size:</span>
        <span className="font-medium">
          {formatFileSize(
            selectedFiles.reduce((sum, f) => sum + f.file.size, 0),
          )}
        </span>
      </div>
      {selectedFiles.length > 10 && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground pt-1 border-t">
          <svg
            className="h-3 w-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>Scroll to see all files</span>
        </div>
      )}
    </div>
  );
}
