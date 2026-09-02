"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { MAX_FILE_SIZE } from "./file-constants";
import { useUploadQueue } from "./upload-file-dialog/use-upload-queue";
import { SelectedFileList } from "./upload-file-dialog/selected-file-list";
import { UploadSummary } from "./upload-file-dialog/upload-summary";
import type { RouterOutputs } from "@/lib/trpc";

type FileData = RouterOutputs["files"]["list"]["files"][number];

interface UploadFileDialogProps {
  onSuccess?: () => void;
  existingFiles?: FileData[];
}

export function UploadFileDialog({
  onSuccess,
  existingFiles = [],
}: UploadFileDialogProps) {
  const {
    uploadDialogOpen,
    setUploadDialogOpen,
    selectedFiles,
    uploadError,
    isDragging,
    isUploading,
    fileInputRef,
    dropZoneRef,
    handleInputChange,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleUpload,
    handleRemoveFile,
    handleClearAll,
  } = useUploadQueue({ onSuccess, existingFiles });

  return (
    <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
      <DialogTrigger asChild>
        <Button
          size="lg"
          className="shadow-sm hover:shadow-md transition-shadow"
        >
          <Upload className="h-4 w-4 mr-2" />
          Upload File
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Upload Files</DialogTitle>
          <DialogDescription>
            Upload one or more PDF, Word, PowerPoint, TXT, Markdown, JSON, or
            CSV files (max {MAX_FILE_SIZE / 1024 / 1024}MB each)
          </DialogDescription>
        </DialogHeader>

        {uploadError && (
          <Alert variant="destructive">
            <AlertDescription>{uploadError}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Drag and Drop Zone */}
          <div
            ref={dropZoneRef}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              "relative border-2 border-dashed rounded-lg p-6 transition-colors flex-1 flex flex-col min-h-0",
              isDragging
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-primary/50",
              selectedFiles.length > 0 && "border-primary/50 bg-primary/5",
            )}
          >
            <input
              id="file"
              type="file"
              ref={fileInputRef}
              onChange={handleInputChange}
              accept=".pdf,.doc,.docx,.pptx,.txt,.md,.json,.csv"
              multiple
              className="hidden"
            />
            {selectedFiles.length > 0 ? (
              <SelectedFileList
                selectedFiles={selectedFiles}
                isUploading={isUploading}
                onRemoveFile={handleRemoveFile}
                onClearAll={handleClearAll}
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-center">
                <div className="rounded-full bg-primary/10 p-3 mb-3">
                  <Upload className="h-6 w-6 text-primary" />
                </div>
                <Label
                  htmlFor="file"
                  className="cursor-pointer text-sm font-medium"
                >
                  <span className="text-primary hover:underline">
                    Click to upload
                  </span>{" "}
                  or drag and drop
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  PDF, Word, PowerPoint, TXT, Markdown, JSON, or CSV (max{" "}
                  {MAX_FILE_SIZE / 1024 / 1024}MB each)
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  You can select multiple files
                </p>
              </div>
            )}
          </div>

          {/* File Summary */}
          {selectedFiles.length > 0 && !isUploading && (
            <UploadSummary selectedFiles={selectedFiles} />
          )}

          {/* Actions */}
          <div className="flex justify-end space-x-2 flex-shrink-0 pt-2 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setUploadDialogOpen(false);
                handleClearAll();
              }}
              disabled={isUploading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={
                selectedFiles.filter((f) => f.status === "pending").length ===
                  0 || isUploading
              }
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload{" "}
                  {selectedFiles.length > 0 && `(${selectedFiles.length})`}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
