"use client";

import { TableCell, TableRow } from "@/components/ui/table";
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

// ── Desktop table row ────────────────────────────────────────────────
export function FileTableRow<T extends BaseFile>({
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
    <TableRow
      className="cursor-pointer hover:bg-muted/50"
      onClick={() => {
        if (showCheckbox && onToggleSelect) {
          onToggleSelect(file.id);
        }
      }}
    >
      {showCheckbox && onToggleSelect && (
        <TableCell onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => {
              e.stopPropagation();
              onToggleSelect(file.id);
            }}
            onClick={(e) => e.stopPropagation()}
            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
            aria-label={`Select ${file.fileName}`}
          />
        </TableCell>
      )}
      <TableCell>
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
            <FileText className="h-4 w-4 text-blue-600" />
          </div>
          <span className="font-medium truncate">{file.fileName}</span>
        </div>
      </TableCell>
      <TableCell>
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {getFileTypeDisplayName(file.fileType)}
        </span>
      </TableCell>
      <TableCell>
        <span className="text-sm whitespace-nowrap">
          {formatFileSize(file.fileSize)}
        </span>
      </TableCell>
      <TableCell>
        <FileStatusBadge
          status={file.processingStatus}
          metadata={file.metadata}
          showProgress={true}
          size="sm"
        />
      </TableCell>
      {showCreatedDate && file.createdAt && (
        <TableCell>
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {formatDate(file.createdAt)}
          </span>
        </TableCell>
      )}
      <TableCell onClick={(e) => e.stopPropagation()} className="text-right">
        <div className="flex items-center justify-end gap-5">
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
      </TableCell>
    </TableRow>
  );
}
