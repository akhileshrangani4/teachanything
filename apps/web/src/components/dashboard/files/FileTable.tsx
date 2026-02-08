"use client";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SortableTableHead, type FileSortBy } from "@/components/data-table";
import type { SortDirection } from "@/hooks/useServerTable";
import {
  FileText,
  Trash2,
  X,
  Plus,
  RefreshCw,
  Download,
  Eye,
} from "lucide-react";
import {
  formatFileSize,
  formatDate,
  getFileTypeDisplayName,
} from "./file-constants";
import { FileStatusBadge } from "./FileStatusBadge";
import { toast } from "sonner";
import { useState } from "react";

// Generic file type that works with both list and listForChatbot responses
type BaseFile = {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  processingStatus: string;
  metadata?: {
    error?: string;
    chunkCount?: number;
    processedAt?: string;
    processingProgress?: {
      stage:
        | "downloading"
        | "extracting"
        | "chunking"
        | "embedding"
        | "storing";
      percentage: number;
      currentChunk?: number;
      totalChunks?: number;
      startedAt?: string;
      lastUpdatedAt?: string;
    };
  };
  createdAt?: Date;
};

type ActionType = "delete" | "remove" | "add" | "none";

// ── Shared hook: computed file state + download handler ──────────────
function useFileActions<T extends BaseFile>(file: T) {
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

  return { isStuck, canRetry, canView, isViewable, isDownloading, handleFileClick };
}

// ── Shared action buttons (view, download, retry, delete/remove/add) ─
function FileActionButtons<T extends BaseFile>({
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

// ── Per-row props shared by desktop and mobile ───────────────────────
interface FileTableRowProps<T extends BaseFile> {
  file: T;
  showCheckbox?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (fileId: string) => void;
  actionType?: ActionType;
  onAction?: (fileId: string) => void;
  actionDisabled?: boolean;
  onRetry?: (fileId: string) => void;
  retryDisabled?: boolean;
  showCreatedDate?: boolean;
}

// ── Desktop table row ────────────────────────────────────────────────
function FileTableRow<T extends BaseFile>({
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
      <TableCell
        onClick={(e) => e.stopPropagation()}
        className="text-right"
      >
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

// ── Mobile card view ─────────────────────────────────────────────────
function FileCardMobile<T extends BaseFile>({
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
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
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

// ── Main FileTable component ─────────────────────────────────────────
interface FileTableProps<T extends BaseFile> {
  files: T[];
  showCheckbox?: boolean;
  selectedFiles?: Set<string>;
  onToggleSelect?: (fileId: string) => void;
  onSelectAll?: () => void;
  allSelected?: boolean;
  actionType?: ActionType;
  onAction?: (fileId: string) => void;
  actionDisabled?: boolean;
  onRetry?: (fileId: string) => void;
  retryDisabled?: boolean;
  showCreatedDate?: boolean;
  emptyMessage?: string;
  sortBy?: FileSortBy;
  sortDir?: SortDirection;
  onSort?: (column: FileSortBy) => void;
}

export function FileTable<T extends BaseFile>({
  files,
  showCheckbox = false,
  selectedFiles,
  onToggleSelect,
  onSelectAll,
  allSelected = false,
  actionType = "none",
  onAction,
  actionDisabled = false,
  onRetry,
  retryDisabled = false,
  showCreatedDate = false,
  emptyMessage = "No files found",
  sortBy,
  sortDir,
  onSort,
}: FileTableProps<T>) {
  const isSortable =
    sortBy !== undefined && sortDir !== undefined && onSort !== undefined;

  const renderColumnHeader = (
    column: FileSortBy,
    label: string,
    className?: string,
  ) => {
    if (isSortable) {
      return (
        <SortableTableHead
          column={column}
          currentSortBy={sortBy}
          currentSortDir={sortDir}
          onSort={onSort}
          className={className}
        >
          {label}
        </SortableTableHead>
      );
    }
    return <TableHead className={className}>{label}</TableHead>;
  };

  if (files.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  const hasCheckbox = showCheckbox && onSelectAll;
  const hasCreated = showCreatedDate;
  const fixedWidth =
    (hasCheckbox ? 3 : 0) + 10 + 10 + 20 + (hasCreated ? 15 : 0) + 12;
  const fileNameWidth = 100 - fixedWidth;

  return (
    <>
      {/* Desktop table view */}
      <div className="hidden md:block">
        <Table style={{ tableLayout: "fixed" }}>
          <colgroup>
            {hasCheckbox && <col style={{ width: "3%" }} />}
            <col style={{ width: `${fileNameWidth}%` }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "20%" }} />
            {hasCreated && <col style={{ width: "15%" }} />}
            <col style={{ width: "12%" }} />
          </colgroup>
          <TableHeader>
            <TableRow>
              {showCheckbox && onSelectAll && (
                <TableHead>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={onSelectAll}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                    aria-label="Select all files"
                  />
                </TableHead>
              )}
              {renderColumnHeader("fileName", "File Name")}
              {renderColumnHeader("fileType", "Type", "whitespace-nowrap")}
              {renderColumnHeader("fileSize", "Size", "whitespace-nowrap")}
              {renderColumnHeader(
                "processingStatus",
                "Status",
                "whitespace-nowrap",
              )}
              {showCreatedDate &&
                renderColumnHeader("createdAt", "Created", "whitespace-nowrap")}
              <TableHead className="whitespace-nowrap text-right">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {files.map((file) => (
              <FileTableRow
                key={file.id}
                file={file}
                showCheckbox={showCheckbox}
                isSelected={selectedFiles?.has(file.id)}
                onToggleSelect={onToggleSelect}
                actionType={actionType}
                onAction={onAction}
                actionDisabled={actionDisabled}
                onRetry={onRetry}
                retryDisabled={retryDisabled}
                showCreatedDate={showCreatedDate}
              />
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile card view */}
      <div className="md:hidden space-y-3">
        {showCheckbox && onSelectAll && (
          <div className="flex items-center gap-2 px-1">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={onSelectAll}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
              aria-label="Select all files"
            />
            <span className="text-sm text-muted-foreground">Select all</span>
          </div>
        )}
        {files.map((file) => (
          <FileCardMobile
            key={file.id}
            file={file}
            showCheckbox={showCheckbox}
            isSelected={selectedFiles?.has(file.id)}
            onToggleSelect={onToggleSelect}
            actionType={actionType}
            onAction={onAction}
            actionDisabled={actionDisabled}
            onRetry={onRetry}
            retryDisabled={retryDisabled}
            showCreatedDate={showCreatedDate}
          />
        ))}
      </div>
    </>
  );
}
