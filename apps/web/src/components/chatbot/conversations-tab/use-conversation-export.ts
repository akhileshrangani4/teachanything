"use client";

import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { logError } from "@/lib/logger";
import { toggleInSet } from "@/lib/selection";
import {
  downloadConversationsExport,
  type ExportFormat,
} from "@/lib/export-conversations";
import { EXPORT_FORMAT_OPTIONS } from "./constants";
import { useTranslation } from "react-i18next";

// Export: `null` = dialog closed; "all" exports every conversation for the
// chatbot, "selected" exports only the checked ids. Formats default to all.
export function useConversationExport({
  chatbotId,
  selected,
}: {
  chatbotId: string;
  selected: Set<string>;
}): {
  exportMode: "all" | "selected" | null;
  isExporting: boolean;
  exportFormats: Set<ExportFormat>;
  openExport: (mode: "all" | "selected") => void;
  closeExport: () => void;
  toggleFormat: (format: ExportFormat) => void;
  runExport: () => Promise<void>;
} {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const [exportMode, setExportMode] = useState<"all" | "selected" | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormats, setExportFormats] = useState<Set<ExportFormat>>(
    () => new Set(EXPORT_FORMAT_OPTIONS),
  );

  const openExport = (mode: "all" | "selected") => setExportMode(mode);
  const closeExport = () => setExportMode(null);

  const toggleFormat = (format: ExportFormat) =>
    setExportFormats((prev) => toggleInSet(prev, format));

  const runExport = async () => {
    if (exportMode === null || exportFormats.size === 0) return;
    setIsExporting(true);
    try {
      const conversationIds =
        exportMode === "selected" ? [...selected] : undefined;
      const data = await utils.analytics.exportConversations.fetch({
        chatbotId,
        conversationIds,
      });
      if (data.conversations.length === 0) {
        toast.error(t("conversations.exportToasts.noRecords"));
        return;
      }
      downloadConversationsExport(
        data,
        EXPORT_FORMAT_OPTIONS.filter((f) => exportFormats.has(f)),
      );
      const count = data.conversations.length;
      if (data.truncated) {
        toast.warning(
          t("conversations.exportToasts.truncated", {
            max: data.maxConversations,
          }),
        );
      } else {
        toast.success(t("conversations.exportToasts.exported", { count }));
      }
      setExportMode(null);
    } catch (err) {
      logError(err, "[conversations] export failed", { chatbotId });
      toast.error(t("conversations.exportToasts.failed"));
    } finally {
      setIsExporting(false);
    }
  };

  return {
    exportMode,
    isExporting,
    exportFormats,
    openExport,
    closeExport,
    toggleFormat,
    runExport,
  };
}
