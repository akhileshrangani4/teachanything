"use client";

import { Button } from "@/components/ui/button";
import { Clock, MessageSquare, Trash2 } from "lucide-react";
import { formatDuration, formatTimestamp } from "@/lib/conversation-format";
import type { ConversationRow } from "./constants";

export function ConversationListItem({
  conversation,
  isSelected,
  onToggle,
  onSelect,
  onDelete,
}: {
  conversation: ConversationRow;
  isSelected: boolean;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex items-start gap-2 px-4 py-3 hover:bg-muted/50 transition-colors">
      <input
        type="checkbox"
        className="h-4 w-4 mt-0.5 shrink-0 cursor-pointer accent-primary"
        checked={isSelected}
        onChange={() => onToggle(conversation.id)}
        aria-label="Select chat"
      />
      <button
        type="button"
        onClick={() => onSelect(conversation.id)}
        className="flex items-center justify-between min-w-0 flex-1 text-left"
      >
        <div className="min-w-0 flex-1 mr-3">
          <p className="text-sm font-medium truncate">
            {conversation.preview || "No messages"}
          </p>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              {conversation.messageCount} message
              {conversation.messageCount !== 1 ? "s" : ""}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDuration(
                conversation.firstMessageAt,
                conversation.lastMessageAt,
              )}
            </span>
            <span>{formatTimestamp(conversation.createdAt)}</span>
          </div>
        </div>
      </button>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 self-center text-muted-foreground hover:text-destructive"
        onClick={() => onDelete(conversation.id)}
        aria-label="Delete chat"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
