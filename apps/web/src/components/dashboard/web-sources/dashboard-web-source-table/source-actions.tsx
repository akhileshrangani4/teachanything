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
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();
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
        aria-label={
          isExpanded
            ? t("webSources.table.hidePages")
            : t("webSources.table.showPages")
        }
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
            aria-label={t("common.actions.moreActions")}
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
              {t("webSources.actions.stopCrawl")}
            </DropdownMenuItem>
          )}
          {(source.status === "completed" || source.status === "failed") && (
            <DropdownMenuItem
              disabled={isRecrawling}
              onClick={() => onRecrawl(source.id)}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              {source.status === "failed"
                ? t("common.actions.retry")
                : t("webSources.actions.recrawl")}
            </DropdownMenuItem>
          )}
          {source.status === "completed" && (
            <DropdownMenuItem onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" />
              {t("webSources.actions.exportJson")}
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
            {t("common.actions.delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmStop} onOpenChange={setConfirmStop}>
        <ConfirmDialogContent
          title={t("webSources.actions.stopCrawl")}
          description={t("webSources.actions.stopDescriptionDashboard")}
          cancelLabel={t("webSources.actions.keepCrawling")}
          confirmLabel={t("webSources.actions.stopCrawl")}
          onConfirm={() => onStop(source.id)}
        />
      </AlertDialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <ConfirmDialogContent
          title={t("webSources.actions.deleteTitle")}
          description={t("webSources.actions.deleteDescription")}
          cancelLabel={t("common.actions.cancel")}
          confirmLabel={t("webSources.actions.deletePermanently")}
          destructive
          onConfirm={() => onDelete(source.id)}
        />
      </AlertDialog>
    </div>
  );
}
