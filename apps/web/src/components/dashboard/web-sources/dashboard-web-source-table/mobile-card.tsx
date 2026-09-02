"use client";

import { getSourceDisplayName } from "@/lib/crawler-metadata";
import { CrawlProgress } from "@/components/chatbot/web-sources/CrawlProgress";
import { CrawledPagesList } from "@/components/chatbot/web-sources/CrawledPagesList";
import { SourceStatusBadge } from "@/components/chatbot/web-sources/StatusBadges";
import { isActiveSource } from "@/components/chatbot/web-sources/utils";
import { ChatbotAttachButton, EnabledSwitch, NameCell } from "./row-cells";
import { SourceActions } from "./source-actions";
import { ZERO_PAGE_COUNTS, type RowProps } from "./types";

export function DashboardSourceCardMobile({
  source,
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
}: RowProps) {
  const isActive = isActiveSource(source);

  return (
    <div
      className={`border border-border/60 rounded-lg p-4 bg-card space-y-3 ${
        source.enabled ? "" : "opacity-60"
      }`}
    >
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(source.id)}
          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer flex-shrink-0"
          aria-label={`Select ${getSourceDisplayName(source)}`}
        />
        <div className="min-w-0 flex-1">
          <NameCell
            source={source}
            isRenaming={isRenaming}
            onRename={onRename}
          />
        </div>
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
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <SourceStatusBadge status={source.status} />
        <span className="bg-muted px-2 py-0.5 rounded text-xs text-muted-foreground">
          {source.pageCount} page{source.pageCount !== 1 ? "s" : ""}
        </span>
        {source.lastCrawledAt && (
          <span className="bg-muted px-2 py-0.5 rounded text-xs text-muted-foreground">
            Last: {new Date(source.lastCrawledAt).toLocaleDateString()}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <EnabledSwitch
            source={source}
            onToggleEnabled={onToggleEnabled}
            isTogglingEnabled={isTogglingEnabled}
          />
          {source.enabled ? "Enabled" : "Disabled"}
        </label>
        <ChatbotAttachButton
          source={source}
          chatbots={chatbots}
          onAttach={onAttach}
          onDetach={onDetach}
          isPending={isAttaching}
        />
      </div>

      {isExpanded && (
        <div>
          {isActive && (
            <CrawlProgress
              status={source.status}
              pageCounts={ZERO_PAGE_COUNTS}
            />
          )}
          <CrawledPagesList crawlSourceId={source.id} isExpanded />
        </div>
      )}
    </div>
  );
}
