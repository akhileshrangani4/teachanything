"use client";

import { useState, useRef, useCallback } from "react";
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
import { toast } from "sonner";
import { Upload, FileText, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  MAX_FILE_SIZE,
  ALLOWED_FILE_TYPES,
  validateFileName,
  formatFileSize,
  getFileTypeDisplayName,
} from "./file-constants";
import { useDirectUpload } from "@/lib/direct-upload";
import type { RouterOutputs } from "@/lib/trpc";

type FileData = RouterOutputs["files"]["list"]["files"][number];

interface UploadFileDialogProps {
  onSuccess?: () => void;
  existingFiles?: FileData[];
}

interface FileUploadState {
  file: File;
  status: "pending" | "uploading" | "success" | "error";
  error?: string;
  progress?: number;
}

export function UploadFileDialog({
  onSuccess,
  existingFiles = [],
}: UploadFileDialogProps) {
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<FileUploadState[]>([]);
  const [uploadError, setUploadError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const { uploadFile: directUploadFile } = useDirectUpload();

  const updateFileStatus = (
    fileName: string,
    status: FileUploadState["status"],
    error?: string,
    progress?: number,
  ) => {
    setSelectedFiles((prev) =>
      prev.map((f) =>
        f.file.name === fileName ? { ...f, status, error, progress } : f,
      ),
    );
  };

  const validateFile = useCallback(
    (file: File): string | null => {
      // Validate file name
      const fileNameError = validateFileName(file.name);
      if (fileNameError) {
        return fileNameError;
      }

      // Validate file size - check for empty files
      if (file.size === 0) {
        return "Cannot upload empty file";
      }

      // Validate file size - check maximum
      if (file.size > MAX_FILE_SIZE) {
        const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);
        return `File size (${fileSizeMB}MB) exceeds the ${MAX_FILE_SIZE / 1024 / 1024}MB limit`;
      }

      // Validate file type
      if (
        !ALLOWED_FILE_TYPES.includes(
          file.type as (typeof ALLOWED_FILE_TYPES)[number],
        )
      ) {
        const displayName = getFileTypeDisplayName(file.type);
        return `File type "${displayName}" is not supported. Please upload PDF, Word (.doc, .docx), PowerPoint (.pptx), Text, Markdown, JSON, or CSV files.`;
      }

      // Check for duplicate file name
      const isDuplicate = existingFiles?.some((f) => f.fileName === file.name);
      if (isDuplicate) {
        return `A file with the name "${file.name}" already exists. Please rename your file or delete the existing one.`;
      }

      return null;
    },
    [existingFiles],
  );

  const handleFileSelect = useCallback(
    (files: File[]) => {
      const validFiles: FileUploadState[] = [];
      const errors: string[] = [];

      files.forEach((file) => {
        const error = validateFile(file);
        if (error) {
          errors.push(`${file.name}: ${error}`);
        } else {
          // Check for duplicates within the selection
          const isDuplicateInSelection = validFiles.some(
            (f) => f.file.name === file.name,
          );
          if (isDuplicateInSelection) {
            errors.push(`${file.name}: Duplicate file in selection`);
          } else {
            validFiles.push({ file, status: "pending" });
          }
        }
      });

      if (errors.length > 0) {
        setUploadError(errors.join("; "));
        if (errors.length === files.length) {
          toast.error("Invalid files", {
            description: errors[0],
          });
        } else {
          toast.warning("Some files were skipped", {
            description: `${errors.length} file(s) had errors`,
          });
        }
      } else {
        setUploadError("");
      }

      if (validFiles.length > 0) {
        setSelectedFiles((prev) => {
          // Merge with existing files, avoiding duplicates
          const existingNames = new Set(prev.map((f) => f.file.name));
          const newFiles = validFiles.filter(
            (f) => !existingNames.has(f.file.name),
          );
          return [...prev, ...newFiles];
        });
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [validateFile],
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      handleFileSelect(files);
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files || []);
      if (files.length > 0) {
        handleFileSelect(files);
      }
    },
    [handleFileSelect],
  );

  const uploadSingleFile = async (
    fileState: FileUploadState,
  ): Promise<void> => {
    const { file } = fileState;
    updateFileStatus(file.name, "uploading", undefined, 0);

    try {
      await directUploadFile(file, (progress) => {
        updateFileStatus(
          file.name,
          "uploading",
          undefined,
          progress.percentage,
        );
      });
      updateFileStatus(file.name, "success", undefined, 100);
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "An error occurred";
      updateFileStatus(file.name, "error", errorMsg);
      throw error;
    }
  };

  const handleUpload = async () => {
    const pendingFiles = selectedFiles.filter((f) => f.status === "pending");
    if (pendingFiles.length === 0) return;

    setIsUploading(true);
    setUploadError("");
    const toastId = toast.loading(
      `Uploading ${pendingFiles.length} file(s)...`,
      {
        description: "Please wait while we process your files",
      },
    );

    let successCount = 0;
    let errorCount = 0;

    // Upload files sequentially to avoid overwhelming the server
    for (const fileState of pendingFiles) {
      try {
        await uploadSingleFile(fileState);
        successCount++;
      } catch {
        errorCount++;
        // Error already handled in uploadSingleFile
      }
    }

    setIsUploading(false);

    // Show summary toast
    if (successCount > 0 && errorCount === 0) {
      toast.success(`Successfully uploaded ${successCount} file(s)`, {
        id: toastId,
        description: "Files are being processed",
      });
      // Close dialog and reset after a short delay
      setTimeout(() => {
        setUploadDialogOpen(false);
        setSelectedFiles([]);
        onSuccess?.();
      }, 1500);
    } else if (successCount > 0 && errorCount > 0) {
      toast.warning(`Uploaded ${successCount} file(s), ${errorCount} failed`, {
        id: toastId,
        description: "Some files failed to upload",
      });
    } else {
      toast.error("Failed to upload files", {
        id: toastId,
        description: "Please check the errors and try again",
      });
    }
  };

  const handleRemoveFile = (fileName: string) => {
    setSelectedFiles((prev) => prev.filter((f) => f.file.name !== fileName));
    if (selectedFiles.length === 1) {
      setUploadError("");
    }
  };

  const handleClearAll = () => {
    setSelectedFiles([]);
    setUploadError("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const getFileIcon = () => {
    return <FileText className="h-8 w-8 text-blue-600" />;
  };

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
                      onClick={handleClearAll}
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
                            <span className="text-red-600 ml-2">
                              • {fileState.error}
                            </span>
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
                          onClick={() => handleRemoveFile(fileState.file.name)}
                          className="h-6 w-6 flex-shrink-0 text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
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
