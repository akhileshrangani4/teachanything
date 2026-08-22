"use client";

import { Card, CardContent } from "@/components/ui/card";
import { FileTableSkeleton } from "@/components/ui/skeletons";
import { EmptyFilesState } from "@/components/dashboard/files/EmptyFilesState";
import { useFilesPage } from "./use-files-page";
import { UploadSection } from "./upload-section";
import { FilesTableSection } from "./files-table-section";
import { FilesPageDialogs } from "./files-page-dialogs";

export default function FilesPage() {
  const files = useFilesPage();
  const {
    table,
    state,
    searchInput,
    files: fileList,
    totalCount,
    totalPages,
    allSelected,
    selectedFiles,
    deletePending,
    retryPending,
    refreshFiles,
    showFullLoading,
    showInlineLoading,
  } = files;

  return (
    <div className="flex-1 p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
          <div>
            <h1 className="text-4xl font-bold text-foreground tracking-tight">
              Files
            </h1>
            <p className="text-muted-foreground mt-2 text-lg">
              List of all of your imported and crawled files.
              {totalCount > 0 && (
                <span className="ml-2 font-medium text-foreground">
                  ({totalCount} {totalCount === 1 ? "file" : "files"})
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Upload Section */}
        <UploadSection onSuccess={refreshFiles} existingFiles={fileList} />

        {/* Display all files */}
        {showFullLoading ? (
          <Card>
            <CardContent className="p-6">
              <FileTableSkeleton />
            </CardContent>
          </Card>
        ) : fileList.length === 0 && !state.search && !searchInput ? (
          <EmptyFilesState />
        ) : (
          <FilesTableSection
            table={table}
            files={fileList}
            totalCount={totalCount}
            totalPages={totalPages}
            selectedFiles={selectedFiles}
            allSelected={allSelected}
            deletePending={deletePending}
            retryPending={retryPending}
            showInlineLoading={showInlineLoading}
            onToggleFile={files.handleToggleFile}
            onSelectAll={files.handleSelectAll}
            onDelete={files.handleDelete}
            onRetry={files.handleRetry}
            onDeleteSelected={files.handleDeleteSelected}
          />
        )}
      </div>

      <FilesPageDialogs
        deleteDialogOpen={files.deleteDialogOpen}
        onDeleteDialogOpenChange={files.setDeleteDialogOpen}
        filesToDelete={files.filesToDelete}
        onConfirmDeleteFiles={files.handleDeleteFiles}
        deletePending={deletePending}
        retryDialogOpen={files.retryDialogOpen}
        onRetryDialogOpenChange={(open) => {
          files.setRetryDialogOpen(open);
          if (!open) files.setFileToRetry(null);
        }}
        onConfirmRetry={files.confirmRetry}
        retryPending={retryPending}
      />
    </div>
  );
}
