"use client";

import { Button } from "@/components/ui/button";
import { FileText, X, Loader2 } from "lucide-react";
import { formatFileSize } from "../file-constants";
import type { FileUploadState } from "./use-upload-queue";

const getFileIcon = () => {
  return <FileText className="h-8 w-8 text-blue-600" />;
};

// Scrollable list of queued files with per-file status icon and progress.
export function SelectedFileList({
  selectedFiles,
  isUploading,
  onRemoveFile,
  onClearAll,
}: {
  selectedFiles: FileUploadState[];
  isUploading: boolean;
  onRemoveFile: (fileName: string) => void;
  onClearAll: () => void;
}) {
  return (
    <div className="space-y-3 w-full flex-1 flex flex-col min-h-0">
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        <p className="text-sm font-medium">
          {selectedFiles.length} file
          {selectedFiles.length !== 1 ? "s" : ""} selected
        </p>
        {!isUploading && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearAll}
            className="h-7 text-xs"
          >
            Clear all
          </Button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto space-y-2 min-h-0 pr-1">
        {selectedFiles.map((fileState) => (
          <div
            key={fileState.file.name}
            className="flex items-start gap-3 w-full p-2 rounded-md border bg-background"
          >
            <div className="flex-shrink-0 mt-0.5">
              {fileState.status === "success" ? (
                <div className="h-5 w-5 rounded-full bg-green-500 flex items-center justify-center">
                  <svg
                    className="h-3 w-3 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
              ) : fileState.status === "error" ? (
                <div className="h-5 w-5 rounded-full bg-red-500 flex items-center justify-center">
                  <X className="h-3 w-3 text-white" />
                </div>
              ) : fileState.status === "uploading" ? (
                <Loader2 className="h-5 w-5 text-primary animate-spin" />
              ) : (
                getFileIcon()
              )}
            </div>
            <div className="flex-1 min-w-0 pr-2" style={{ width: 0 }}>
              <p
                className="font-medium text-sm truncate"
                title={fileState.file.name}
              >
                {fileState.file.name}
              </p>
              <p className="text-xs text-muted-foreground mt-1 truncate">
                {formatFileSize(fileState.file.size)}
                {fileState.status === "error" && fileState.error && (
                  <span className="text-red-600 ml-2">• {fileState.error}</span>
                )}
              </p>
              {fileState.status === "uploading" &&
                fileState.progress !== undefined && (
                  <div className="mt-2">
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-300"
                        style={{ width: `${fileState.progress}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {fileState.progress}%
                    </p>
                  </div>
                )}
            </div>
            {fileState.status === "pending" && !isUploading && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onRemoveFile(fileState.file.name)}
                className="h-6 w-6 flex-shrink-0 text-muted-foreground hover:text-destructive"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
