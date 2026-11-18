"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ExportFormat } from "@/lib/export-conversations";
import { EXPORT_FORMAT_OPTIONS } from "./constants";
import { useTranslation } from "react-i18next";

export function ExportDialog({
  open,
  mode,
  selectedCount,
  exportFormats,
  isExporting,
  onToggleFormat,
  onClose,
  onExport,
}: {
  open: boolean;
  mode: "all" | "selected" | null;
  selectedCount: number;
  exportFormats: Set<ExportFormat>;
  isExporting: boolean;
  onToggleFormat: (format: ExportFormat) => void;
  onClose: () => void;
  onExport: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Dialog
      open={open}
      onOpenChange={(dialogOpen) => {
        if (!dialogOpen && !isExporting) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("conversations.exportDialog.title", {
              mode: mode === "selected" ? "selected" : "all",
              count: selectedCount,
            })}
          </DialogTitle>
          <DialogDescription>
            {t("conversations.exportDialog.description")}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-2">
          {EXPORT_FORMAT_OPTIONS.map((option) => (
            <label
              key={option}
              className="flex items-start gap-3 cursor-pointer"
            >
              <input
                type="checkbox"
                className="h-4 w-4 mt-0.5 shrink-0 cursor-pointer accent-primary"
                checked={exportFormats.has(option)}
                onChange={() => onToggleFormat(option)}
              />
              <span className="min-w-0">
                <span className="text-sm font-medium">
                  {t(`conversations.exportDialog.formats.${option}Label`)}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {t(`conversations.exportDialog.formats.${option}Description`)}
                </span>
              </span>
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isExporting}>
            {t("common.actions.cancel")}
          </Button>
          <Button
            onClick={onExport}
            disabled={isExporting || exportFormats.size === 0}
          >
            {isExporting
              ? t("conversations.exportDialog.exporting")
              : t("conversations.exportDialog.export")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
