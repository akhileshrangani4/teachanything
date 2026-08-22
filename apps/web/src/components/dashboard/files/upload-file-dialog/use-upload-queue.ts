"use client";

import { useState, useRef, useCallback } from "react";
import { toast } from "sonner";
import {
  MAX_FILE_SIZE,
  ALLOWED_FILE_TYPES,
  validateFileName,
  getFileTypeDisplayName,
} from "../file-constants";
import { useDirectUpload } from "@/lib/direct-upload";
import type { RouterOutputs } from "@/lib/trpc";

type FileData = RouterOutputs["files"]["list"]["files"][number];

export interface FileUploadState {
  file: File;
  status: "pending" | "uploading" | "success" | "error";
  error?: string;
  progress?: number;
}

// Owns all upload queue state and handlers for UploadFileDialog.
export function useUploadQueue({
  onSuccess,
  existingFiles = [],
}: {
  onSuccess?: () => void;
  existingFiles?: FileData[];
}) {
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

  return {
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
  };
}
