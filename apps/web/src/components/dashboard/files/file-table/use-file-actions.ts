"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { BaseFile } from "./types";

// ── Shared hook: computed file state + download handler ──────────────
export function useFileActions<T extends BaseFile>(file: T) {
  const [isDownloading, setIsDownloading] = useState(false);

  const isStuck =
    file.processingStatus === "processing" &&
    file.metadata?.processingProgress?.lastUpdatedAt &&
    Date.now() -
      new Date(file.metadata.processingProgress.lastUpdatedAt).getTime() >
      30 * 60 * 1000; // 30 minutes

  const canRetry =
    file.processingStatus === "failed" ||
    file.processingStatus === "pending" ||
    file.processingStatus === "processing";

  const canView = file.processingStatus === "completed";
  const isViewable = file.fileType === "application/pdf";

  const handleFileClick = async (
    e: React.MouseEvent,
    forceDownload = false,
  ) => {
    e.stopPropagation();
    if (!canView) {
      toast.error("File is not ready", {
        description: "Please wait for the file to finish processing",
      });
      return;
    }
    setIsDownloading(true);
    try {
      const downloadParam =
        forceDownload || !isViewable ? "?download=true" : "";
      const url = `/api/files/${file.id}/download${downloadParam}`;
      if (forceDownload || !isViewable) {
        const link = document.createElement("a");
        link.href = url;
        link.download = file.fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("Download started");
      } else {
        window.open(url, "_blank");
      }
    } catch (error) {
      toast.error("Failed to access file", {
        description:
          error instanceof Error ? error.message : "Please try again",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  return {
    isStuck,
    canRetry,
    canView,
    isViewable,
    isDownloading,
    handleFileClick,
  };
}
