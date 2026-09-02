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
            Export{" "}
            {mode === "selected"
              ? `${selectedCount} selected chat${selectedCount !== 1 ? "s" : ""}`
              : "all chats"}
          </DialogTitle>
          <DialogDescription>
            Choose the formats to include. A README explaining each file is
            added automatically, and everything downloads as a single .zip.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-2">
          {EXPORT_FORMAT_OPTIONS.map((option) => (
            <label
              key={option.value}
              className="flex items-start gap-3 cursor-pointer"
            >
              <input
                type="checkbox"
                className="h-4 w-4 mt-0.5 shrink-0 cursor-pointer accent-primary"
                checked={exportFormats.has(option.value)}
                onChange={() => onToggleFormat(option.value)}
              />
              <span className="min-w-0">
                <span className="text-sm font-medium">{option.label}</span>
                <span className="block text-xs text-muted-foreground">
                  {option.description}
                </span>
              </span>
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isExporting}>
            Cancel
          </Button>
          <Button
            onClick={onExport}
            disabled={isExporting || exportFormats.size === 0}
          >
            {isExporting ? "Exporting..." : "Export"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
