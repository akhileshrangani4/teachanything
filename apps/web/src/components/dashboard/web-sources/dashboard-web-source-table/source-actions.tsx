"use client";

import { useState } from "react";
import {
  ChevronDown,
  Download,
  MoreVertical,
  RefreshCw,
  Trash2,
  CircleStop,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { useExportSource } from "@/hooks/use-export-source";
import { ConfirmDialogContent } from "@/components/chatbot/web-sources/ConfirmDialogContent";
import { isActiveSource } from "@/components/chatbot/web-sources/utils";
import type { DashboardSource } from "./types";

// Expand chevron + overflow menu (recrawl, export, delete).
export function SourceActions({
  source,
  isExpanded,
  onToggleExpand,
  onRecrawl,
  onDelete,
  onStop,
  isRecrawling,
  isDeleting,
  isStopping,
}: {
  source: DashboardSource;
  isExpanded: boolean;
  onToggleExpand: (sourceId: string) => void;
  onRecrawl: (sourceId: string) => void;
  onDelete: (sourceId: string) => void;
  onStop: (sourceId: string) => void;
  isRecrawling: boolean;
  isDeleting: boolean;
  isStopping: boolean;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmStop, setConfirmStop] = useState(false);
  const handleExport = useExportSource(source.id, source.rootUrl);
  const isActive = isActiveSource(source);

  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-foreground"
        onClick={() => onToggleExpand(source.id)}
        aria-label={isExpanded ? "Hide crawled pages" : "Show crawled pages"}
      >
        <ChevronDown
          className={`h-4 w-4 transition-transform ${
            isExpanded ? "rotate-180" : ""
          }`}
        />
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label="More actions"
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          {isActive && (
            <DropdownMenuItem
              disabled={isStopping}
              onSelect={(e) => {
                e.preventDefault();
                setConfirmStop(true);
              }}
            >
              <CircleStop className="mr-2 h-4 w-4" />
              Stop crawl
            </DropdownMenuItem>
          )}
          {(source.status === "completed" || source.status === "failed") && (
            <DropdownMenuItem
              disabled={isRecrawling}
              onClick={() => onRecrawl(source.id)}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              {source.status === "failed" ? "Retry" : "Re-crawl"}
            </DropdownMenuItem>
          )}
          {source.status === "completed" && (
            <DropdownMenuItem onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" />
              Export JSON
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={isDeleting}
            onSelect={(e) => {
              e.preventDefault();
              setConfirmDelete(true);
            }}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmStop} onOpenChange={setConfirmStop}>
        <ConfirmDialogContent
          title="Stop crawl"
          description="Stop this crawl now. Pages already crawled are kept; the rest are skipped. You can re-crawl or delete the source afterwards."
          cancelLabel="Keep crawling"
          confirmLabel="Stop crawl"
          onConfirm={() => onStop(source.id)}
        />
      </AlertDialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <ConfirmDialogContent
          title="Delete web source"
          description="Permanently delete this web source and all of its crawled pages. It will be detached from every chatbot. This cannot be undone."
          cancelLabel="Cancel"
          confirmLabel="Delete permanently"
          destructive
          onConfirm={() => onDelete(source.id)}
        />
      </AlertDialog>
    </div>
  );
}
