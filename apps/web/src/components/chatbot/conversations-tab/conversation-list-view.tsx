"use client";

import { useState } from "react";
import { Download, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { logError } from "@/lib/logger";
import { toggleAllInSet, toggleInSet } from "@/lib/selection";
import type { ConversationRow } from "./constants";
import { ConversationListItem } from "./conversation-list-item";
import { DeleteConversationsDialog } from "./delete-conversations-dialog";
import { ExportDialog } from "./export-dialog";
import { useConversationExport } from "./use-conversation-export";

export function ConversationListView({
  chatbotId,
  conversations,
  totalCount,
  limit,
  offset,
  onSelectConversation,
  onOffsetChange,
}: {
  chatbotId: string;
  conversations: ConversationRow[];
  totalCount: number;
  limit: number;
  offset: number;
  onSelectConversation: (id: string) => void;
  onOffsetChange: (offset: number) => void;
}) {
  const utils = trpc.useUtils();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Pending delete: a specific list of ids (single trash or bulk). null = closed.
  const [pendingIds, setPendingIds] = useState<string[] | null>(null);

  const deleteMutation = trpc.analytics.deleteConversations.useMutation({
    onSuccess: async ({ deletedCount }) => {
      toast.success(
        `Deleted ${deletedCount} chat${deletedCount !== 1 ? "s" : ""}`,
      );
      setSelected(new Set());
      setPendingIds(null);
      // If the current page may now be empty, step back to the previous one.
      if (offset > 0 && deletedCount >= conversations.length) {
        onOffsetChange(Math.max(0, offset - limit));
      }
      await Promise.all([
        utils.analytics.getConversationsList.invalidate({ chatbotId }),
        utils.analytics.searchConversations.invalidate({ chatbotId }),
      ]);
    },
    onError: (err) => {
      logError(err, "[conversations] delete failed", { chatbotId });
      toast.error("Failed to delete. Please try again.");
      setPendingIds(null);
    },
  });

  const toggle = (id: string) => setSelected((prev) => toggleInSet(prev, id));

  const allVisibleSelected =
    conversations.length > 0 && conversations.every((c) => selected.has(c.id));

  const toggleAllVisible = () =>
    setSelected((prev) =>
      toggleAllInSet(
        prev,
        conversations.map((c) => c.id),
      ),
    );

  const {
    exportMode,
    isExporting,
    exportFormats,
    openExport,
    closeExport,
    toggleFormat,
    runExport,
  } = useConversationExport({ chatbotId, selected });

  return (
    <div className="flex flex-1 min-h-0 flex-col gap-2">
      <div className="flex-1 min-h-0 overflow-y-auto rounded-lg border">
        {/* Sticky selection header — px-4 + h-4 checkbox so it lines up
            exactly above the per-row checkboxes. */}
        <div className="sticky top-0 z-10 flex h-11 items-center justify-between gap-2 px-4 bg-background border-b">
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              className="h-4 w-4 cursor-pointer accent-primary"
              checked={allVisibleSelected}
              onChange={toggleAllVisible}
              aria-label="Select all on this page"
            />
            {selected.size > 0 ? `${selected.size} selected` : "Select all"}
          </label>
          <div className="flex items-center gap-1">
            {selected.size > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7"
                onClick={() => openExport("selected")}
              >
                <Download className="h-3.5 w-3.5 mr-1" />
                Export selected
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-7"
              onClick={() => openExport("all")}
            >
              <Download className="h-3.5 w-3.5 mr-1" />
              Export all
            </Button>
            {selected.size > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-destructive hover:text-destructive"
                onClick={() => setPendingIds([...selected])}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Delete selected
              </Button>
            )}
          </div>
        </div>
        <div className="divide-y">
          {conversations.map((conversation) => (
            <ConversationListItem
              key={conversation.id}
              conversation={conversation}
              isSelected={selected.has(conversation.id)}
              onToggle={toggle}
              onSelect={onSelectConversation}
              onDelete={(id) => setPendingIds([id])}
            />
          ))}
        </div>
      </div>

      <DeleteConversationsDialog
        pendingIds={pendingIds}
        isPending={deleteMutation.isPending}
        onClose={() => setPendingIds(null)}
        onConfirm={(conversationIds) =>
          deleteMutation.mutate({
            chatbotId,
            conversationIds,
          })
        }
      />

      <ExportDialog
        open={exportMode !== null}
        mode={exportMode}
        selectedCount={selected.size}
        exportFormats={exportFormats}
        isExporting={isExporting}
        onToggleFormat={toggleFormat}
        onClose={closeExport}
        onExport={runExport}
      />

      {totalCount > limit && (
        <div className="flex items-center justify-between px-1 shrink-0">
          <span className="text-xs text-muted-foreground">
            Showing {offset + 1}-{Math.min(offset + limit, totalCount)} of{" "}
            {totalCount}
          </span>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOffsetChange(Math.max(0, offset - limit))}
              disabled={offset === 0}
            >
              Previous
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOffsetChange(offset + limit)}
              disabled={offset + limit >= totalCount}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
