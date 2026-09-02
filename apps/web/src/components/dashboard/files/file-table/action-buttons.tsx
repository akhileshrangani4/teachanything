"use client";

import { Button } from "@/components/ui/button";
import { Download, Eye, Plus, RefreshCw, Trash2, X } from "lucide-react";
import type { ActionType, BaseFile } from "./types";

// ── Shared action buttons (view, download, retry, delete/remove/add) ─
export function FileActionButtons<T extends BaseFile>({
  file,
  actionType,
  onAction,
  actionDisabled,
  onRetry,
  retryDisabled,
  isStuck,
  canRetry,
  canView,
  isViewable,
  isDownloading,
  handleFileClick,
}: {
  file: T;
  actionType: ActionType;
  onAction?: (fileId: string) => void;
  actionDisabled: boolean;
  onRetry?: (fileId: string) => void;
  retryDisabled: boolean;
  isStuck: boolean | "" | undefined;
  canRetry: boolean;
  canView: boolean;
  isViewable: boolean;
  isDownloading: boolean;
  handleFileClick: (e: React.MouseEvent, forceDownload?: boolean) => void;
}) {
  return (
    <>
      {canView && (
        <>
          {isViewable && (
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                handleFileClick(e, false);
              }}
              disabled={isDownloading}
              className="h-8 w-8 text-muted-foreground hover:text-blue-600 hover:bg-blue-50"
              title="View in new tab"
            >
              <Eye className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              handleFileClick(e, true);
            }}
            disabled={isDownloading}
            className="h-8 w-8 text-muted-foreground hover:text-blue-600 hover:bg-blue-50"
            title="Download"
          >
            <Download className="h-4 w-4" />
          </Button>
        </>
      )}

      {canRetry && onRetry && (
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            onRetry(file.id);
          }}
          disabled={retryDisabled}
          className="h-8 w-8 text-muted-foreground hover:text-blue-600 hover:bg-blue-50"
          title={
            file.processingStatus === "processing" && !isStuck
              ? "Cancel and restart"
              : "Retry processing"
          }
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      )}

      {actionType === "delete" && onAction && (
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            onAction(file.id);
          }}
          disabled={actionDisabled}
          className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          title="Delete"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}

      {actionType === "remove" && onAction && (
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onAction(file.id);
          }}
          disabled={actionDisabled}
          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
        >
          <X className="h-4 w-4 mr-1" />
          Remove
        </Button>
      )}

      {actionType === "add" && onAction && (
        <Button
          size="sm"
          variant="outline"
          onClick={(e) => {
            e.stopPropagation();
            onAction(file.id);
          }}
          disabled={actionDisabled}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      )}
    </>
  );
}
