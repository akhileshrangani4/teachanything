"use client";

import { ChevronDown, Globe } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EditableName } from "@/components/ui/editable-name";
import { Switch } from "@/components/ui/switch";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  getSourceDisplayName,
  getSourceErrorCount,
  getSourcePageCount,
} from "@/lib/crawler-metadata";
import { useExportSource } from "@/hooks/use-export-source";
import { isActiveSource } from "../utils";
import { CrawlProgress } from "../CrawlProgress";
import { CrawledPagesList } from "../CrawledPagesList";
import { SourceStatusBadge } from "../StatusBadges";
import { WebSourceRowActions } from "./row-actions";
import type { WebSourceRowProps } from "./types";
import { useTranslation } from "react-i18next";

// ── Desktop table row (+ optional expanded pages row) ────────────────
export function WebSourceTableRow({
  source,
  colSpan,
  showCheckbox = false,
  isSelected = false,
  onToggleSelect,
  isExpanded = false,
  onToggleExpand,
  onRecrawl,
  onRemove,
  onStop,
  onToggleEnabled,
  onRename,
  isRecrawling = false,
  isRemoving = false,
  isStopping = false,
  isTogglingEnabled = false,
  isRenaming = false,
}: WebSourceRowProps & { colSpan: number }) {
  const { t, i18n } = useTranslation();
  const handleExport = useExportSource(source.id, source.rootUrl);
  const isActive = isActiveSource(source);
  const pageCount = getSourcePageCount(source);
  const errorCount = getSourceErrorCount(source);

  return (
    <>
      <TableRow className={source.enabled ? "" : "opacity-60"}>
        {showCheckbox && onToggleSelect && (
          <TableCell onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggleSelect(source.id)}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
              aria-label={t("common.table.selectRow", {
                name: getSourceDisplayName(source),
              })}
            />
          </TableCell>
        )}
        <TableCell>
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
              <Globe className="h-4 w-4 text-blue-600" />
            </div>
            <EditableName
              value={getSourceDisplayName(source)}
              fallback={source.rootUrl}
              ariaLabel={t("webSources.table.rename")}
              isSaving={isRenaming}
              onSave={(name) => onRename(source.id, name)}
              className="text-sm font-medium min-w-0"
            />
          </div>
        </TableCell>
        <TableCell>
          <span className="text-sm whitespace-nowrap">
            {t("webSources.table.pageCount", { count: pageCount })}
          </span>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            {source.enabled ? (
              <SourceStatusBadge status={source.status} />
            ) : (
              <Badge variant="secondary">
                {t("webSources.statusFilter.disabled")}
              </Badge>
            )}
            {source.status === "completed" && errorCount > 0 && (
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {t("webSources.table.errorCount", { count: errorCount })}
              </span>
            )}
          </div>
        </TableCell>
        <TableCell>
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {source.lastCrawledAt
              ? new Date(source.lastCrawledAt).toLocaleDateString(i18n.language)
              : "—"}
          </span>
        </TableCell>
        <TableCell className="text-right">
          <div className="flex items-center justify-end gap-2">
            <div
              title={
                source.enabled
                  ? t("webSources.table.disableThisSource")
                  : t("webSources.table.enableThisSource")
              }
            >
              <Switch
                checked={source.enabled}
                onCheckedChange={(enabled) =>
                  onToggleEnabled(source.id, enabled)
                }
                disabled={isTogglingEnabled}
                aria-label={t("webSources.table.toggleSource")}
              />
            </div>
            <WebSourceRowActions
              source={source}
              isRecrawling={isRecrawling}
              isRemoving={isRemoving}
              isStopping={isStopping}
              onExport={handleExport}
              onRecrawl={() => onRecrawl(source.id)}
              onRemove={() => onRemove(source.id)}
              onStop={() => onStop(source.id)}
            />
            {onToggleExpand && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={() => onToggleExpand(source.id)}
                aria-label={t(
                  isExpanded
                    ? "webSources.table.hidePagesFor"
                    : "webSources.table.showPagesFor",
                  { name: getSourceDisplayName(source) },
                )}
              >
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${
                    isExpanded ? "rotate-180" : ""
                  }`}
                />
              </Button>
            )}
          </div>
        </TableCell>
      </TableRow>
      {isExpanded && (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={colSpan} className="p-0">
            {isActive && (
              <CrawlProgress
                status={source.status}
                pageCounts={source.pageCounts}
              />
            )}
            <CrawledPagesList crawlSourceId={source.id} isExpanded />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
