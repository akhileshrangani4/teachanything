"use client";

import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SortableTableHead, type FileSortBy } from "@/components/data-table";
import type { SortDirection } from "@/hooks/useServerTable";
import { ResponsiveTableShell } from "@/components/chatbot/web-sources/ResponsiveTableShell";
import { FileTableRow } from "./file-table/desktop-row";
import { FileCardMobile } from "./file-table/mobile-card";
import type { ActionType, BaseFile } from "./file-table/types";

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
    <ResponsiveTableShell
      selectAll={
        showCheckbox && onSelectAll
          ? {
              checked: allSelected,
              onChange: onSelectAll,
              ariaLabel: "Select all files",
            }
          : undefined
      }
      desktop={
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
      }
      mobile={files.map((file) => (
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
    />
  );
}
