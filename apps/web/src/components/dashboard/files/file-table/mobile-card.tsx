"use client";

import { FileText } from "lucide-react";
import {
  formatFileSize,
  formatDate,
  getFileTypeDisplayName,
} from "../file-constants";
import { FileStatusBadge } from "../FileStatusBadge";
import { FileActionButtons } from "./action-buttons";
import { useFileActions } from "./use-file-actions";
import type { BaseFile, FileTableRowProps } from "./types";

// ── Mobile card view ─────────────────────────────────────────────────
export function FileCardMobile<T extends BaseFile>({
  file,
  showCheckbox = false,
  isSelected = false,
  onToggleSelect,
  actionType = "none",
  onAction,
  actionDisabled = false,
  onRetry,
  retryDisabled = false,
  showCreatedDate = false,
}: FileTableRowProps<T>) {
  const actions = useFileActions(file);

  return (
    <div
      className="border border-border/60 rounded-lg p-4 bg-card space-y-3"
      onClick={() => {
        if (showCheckbox && onToggleSelect) {
          onToggleSelect(file.id);
        }
      }}
    >
      {/* Top row: checkbox + icon + name */}
      <div className="flex items-center gap-3">
        {showCheckbox && onToggleSelect && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => {
              e.stopPropagation();
              onToggleSelect(file.id);
            }}
            onClick={(e) => e.stopPropagation()}
            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer flex-shrink-0"
            aria-label={`Select ${file.fileName}`}
          />
        )}
        <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
          <FileText className="h-4 w-4 text-blue-600" />
        </div>
        <span className="font-medium truncate flex-1">{file.fileName}</span>
      </div>

      {/* Metadata badges */}
      <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
        <span className="bg-muted px-2 py-0.5 rounded">
          {getFileTypeDisplayName(file.fileType)}
        </span>
        <span className="bg-muted px-2 py-0.5 rounded">
          {formatFileSize(file.fileSize)}
        </span>
        {showCreatedDate && file.createdAt && (
          <span className="bg-muted px-2 py-0.5 rounded">
            {formatDate(file.createdAt)}
          </span>
        )}
      </div>

      {/* Status + actions row */}
      <div className="flex items-center justify-between gap-2">
        <FileStatusBadge
          status={file.processingStatus}
          metadata={file.metadata}
          showProgress={true}
          size="sm"
        />
        <div
          className="flex items-center gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          <FileActionButtons
            file={file}
            actionType={actionType}
            onAction={onAction}
            actionDisabled={actionDisabled}
            onRetry={onRetry}
            retryDisabled={retryDisabled}
            {...actions}
          />
        </div>
      </div>
    </div>
  );
}
