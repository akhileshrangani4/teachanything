"use client";

import { TableCell, TableRow } from "@/components/ui/table";
import { getSourceDisplayName } from "@/lib/crawler-metadata";
import { CrawlProgress } from "@/components/chatbot/web-sources/CrawlProgress";
import { CrawledPagesList } from "@/components/chatbot/web-sources/CrawledPagesList";
import { SourceStatusBadge } from "@/components/chatbot/web-sources/StatusBadges";
import { isActiveSource } from "@/components/chatbot/web-sources/utils";
import { ChatbotAttachButton, EnabledSwitch, NameCell } from "./row-cells";
import { SourceActions } from "./source-actions";
import { ZERO_PAGE_COUNTS, type RowProps } from "./types";

export function DashboardTableRow({
  source,
  colSpan,
  chatbots,
  isSelected,
  onToggleSelect,
  isExpanded,
  onToggleExpand,
  onAttach,
  onDetach,
  isAttaching,
  onRecrawl,
  onDelete,
  onStop,
  onToggleEnabled,
  onRename,
  isRecrawling,
  isDeleting,
  isStopping,
  isTogglingEnabled,
  isRenaming,
}: RowProps & { colSpan: number }) {
  const isActive = isActiveSource(source);

  return (
    <>
      <TableRow className={source.enabled ? "" : "opacity-60"}>
        <TableCell onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect(source.id)}
            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
            aria-label={`Select ${getSourceDisplayName(source)}`}
          />
        </TableCell>
        <TableCell>
          <NameCell
            source={source}
            isRenaming={isRenaming}
            onRename={onRename}
          />
        </TableCell>
        <TableCell>
          <span className="text-sm whitespace-nowrap">
            {source.pageCount} page{source.pageCount !== 1 ? "s" : ""}
          </span>
        </TableCell>
        <TableCell>
          <SourceStatusBadge status={source.status} />
        </TableCell>
        <TableCell>
          <EnabledSwitch
            source={source}
            onToggleEnabled={onToggleEnabled}
            isTogglingEnabled={isTogglingEnabled}
          />
        </TableCell>
        <TableCell>
          <ChatbotAttachButton
            source={source}
            chatbots={chatbots}
            onAttach={onAttach}
            onDetach={onDetach}
            isPending={isAttaching}
          />
        </TableCell>
        <TableCell>
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {source.lastCrawledAt
              ? new Date(source.lastCrawledAt).toLocaleDateString()
              : "—"}
          </span>
        </TableCell>
        <TableCell className="text-right">
          <SourceActions
            source={source}
            isExpanded={isExpanded}
            onToggleExpand={onToggleExpand}
            onRecrawl={onRecrawl}
            onDelete={onDelete}
            onStop={onStop}
            isRecrawling={isRecrawling}
            isDeleting={isDeleting}
            isStopping={isStopping}
          />
        </TableCell>
      </TableRow>
      {isExpanded && (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={colSpan} className="p-0">
            {isActive && (
              <CrawlProgress
                status={source.status}
                pageCounts={ZERO_PAGE_COUNTS}
              />
            )}
            <CrawledPagesList crawlSourceId={source.id} isExpanded />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
