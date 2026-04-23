"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ChatMessage } from "@/components/chat/messages/ChatMessage";
import type { ChatMessage as ChatMessageType } from "@/types/database";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc, type RouterOutputs } from "@/lib/trpc";
import { keepPreviousData } from "@tanstack/react-query";
import { MessageSquare, Search, ArrowLeft, Clock } from "lucide-react";
import { logError } from "@/lib/logger";

type ConversationRow =
  RouterOutputs["analytics"]["getConversationsList"]["conversations"][number];

interface ConversationsTabProps {
  chatbotId: string;
}

type SortBy = "recent" | "mostMessages" | "longestDuration";

function formatDuration(firstAt: Date | null, lastAt: Date | null): string {
  if (!firstAt || !lastAt) return "-";
  const ms = Math.max(
    0,
    new Date(lastAt).getTime() - new Date(firstAt).getTime(),
  );
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
  const hours = Math.floor(ms / 3600000);
  const mins = Math.round((ms % 3600000) / 60000);
  return `${hours}h ${mins}m`;
}

function formatTimestamp(date: Date | string): string {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays === 0) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

export function ConversationsTab({ chatbotId }: ConversationsTabProps) {
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(null);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebouncedValue(searchQuery.trim(), 300);
  const [sortBy, setSortBy] = useState<SortBy>("recent");
  const [offset, setOffset] = useState(0);
  const limit = 5;

  // Reset pagination when the effective query or sort changes.
  useEffect(() => {
    setOffset(0);
  }, [debouncedSearch, sortBy]);

  if (selectedConversationId) {
    return (
      <ConversationDetail
        key={selectedConversationId}
        chatbotId={chatbotId}
        conversationId={selectedConversationId}
        onBack={() => setSelectedConversationId(null)}
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Conversations
          </CardTitle>
          <CardDescription className="mt-1.5">
            Browse student conversations with your chatbot.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            value={sortBy}
            onValueChange={(v) => setSortBy(v as SortBy)}
            disabled={!!debouncedSearch}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Most Recent</SelectItem>
              <SelectItem value="mostMessages">Most Messages</SelectItem>
              <SelectItem value="longestDuration">Longest Duration</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <ConversationsResults
          chatbotId={chatbotId}
          search={debouncedSearch}
          sortBy={sortBy}
          limit={limit}
          offset={offset}
          onSelectConversation={setSelectedConversationId}
          onOffsetChange={setOffset}
        />
      </CardContent>
    </Card>
  );
}

function ConversationsResults({
  chatbotId,
  search,
  sortBy,
  limit,
  offset,
  onSelectConversation,
  onOffsetChange,
}: {
  chatbotId: string;
  search: string;
  sortBy: SortBy;
  limit: number;
  offset: number;
  onSelectConversation: (id: string) => void;
  onOffsetChange: (offset: number) => void;
}) {
  const listQuery = trpc.analytics.getConversationsList.useQuery(
    { chatbotId, sortBy, limit, offset },
    { enabled: !search, placeholderData: keepPreviousData },
  );
  const searchResultsQuery = trpc.analytics.searchConversations.useQuery(
    { chatbotId, query: search, limit, offset },
    { enabled: !!search, placeholderData: keepPreviousData },
  );

  const active = search ? searchResultsQuery : listQuery;
  const { data, isLoading, error } = active;

  useEffect(() => {
    if (error) {
      logError(error, "[conversations] query failed", {
        chatbotId,
        search: search || undefined,
      });
    }
  }, [error, chatbotId, search]);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <MessageSquare className="h-12 w-12 mx-auto mb-4 text-red-500 opacity-50" />
        <p className="text-lg font-medium text-red-600">
          Failed to load conversations
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          Please try again in a moment.
        </p>
      </div>
    );
  }

  if (!data || data.conversations.length === 0) {
    if (search) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">No results found</p>
          <p className="text-sm mt-1">Try a different search term.</p>
        </div>
      );
    }
    return (
      <div className="text-center py-12 text-muted-foreground">
        <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="text-lg font-medium">No conversations yet</p>
        <p className="text-sm mt-1">
          Conversations will appear here when students start chatting with your
          bot.
        </p>
      </div>
    );
  }

  return (
    <ConversationListView
      conversations={data.conversations}
      totalCount={data.totalCount}
      limit={limit}
      offset={offset}
      onSelectConversation={onSelectConversation}
      onOffsetChange={onOffsetChange}
    />
  );
}

function ConversationListView({
  conversations,
  totalCount,
  limit,
  offset,
  onSelectConversation,
  onOffsetChange,
}: {
  conversations: ConversationRow[];
  totalCount: number;
  limit: number;
  offset: number;
  onSelectConversation: (id: string) => void;
  onOffsetChange: (offset: number) => void;
}) {
  return (
    <>
      <div className="divide-y rounded-lg border">
        {conversations.map((conversation) => (
          <button
            key={conversation.id}
            type="button"
            onClick={() => onSelectConversation(conversation.id)}
            className="flex items-center justify-between w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors"
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
        ))}
      </div>
      {totalCount > limit && (
        <div className="flex items-center justify-between px-1 pt-2">
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
    </>
  );
}

function ConversationDetail({
  chatbotId,
  conversationId,
  onBack,
}: {
  chatbotId: string;
  conversationId: string;
  onBack: () => void;
}) {
  const [offset, setOffset] = useState(0);
  const limit = 100;

  const { data, isLoading, error } =
    trpc.analytics.getConversationMessages.useQuery({
      chatbotId,
      conversationId,
      limit,
      offset,
    });

  useEffect(() => {
    if (error) {
      logError(error, "[conversations] detail query failed", {
        chatbotId,
        conversationId,
      });
    }
  }, [error, chatbotId, conversationId]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <CardTitle className="text-lg">Conversation</CardTitle>
            {data?.conversation && (
              <CardDescription>
                Started {formatTimestamp(data.conversation.createdAt)} ·
                Session: {data.conversation.sessionId.slice(0, 8)}...
              </CardDescription>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 text-red-500 opacity-50" />
            <p className="text-lg font-medium text-red-600">
              Failed to load messages
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Please try again in a moment.
            </p>
          </div>
        ) : !data || data.messages.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No messages in this conversation.</p>
          </div>
        ) : (
          <>
            <div className="space-y-4 h-[600px] overflow-y-auto pr-2">
              {data.messages
                .filter((m) => m.role === "user" || m.role === "assistant")
                .map((msg) => {
                  const chatMessage: ChatMessageType = {
                    role: msg.role as "user" | "assistant",
                    content: msg.content,
                    sources: msg.metadata?.sources,
                  };
                  return (
                    <ChatMessage
                      key={msg.id}
                      message={chatMessage}
                      showSources
                    />
                  );
                })}
            </div>
            {data.totalCount > limit && (
              <div className="flex items-center justify-between pt-4 mt-4 border-t">
                <span className="text-xs text-muted-foreground">
                  Showing {offset + 1}-
                  {Math.min(offset + limit, data.totalCount)} of{" "}
                  {data.totalCount} messages
                </span>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setOffset(Math.max(0, offset - limit))}
                    disabled={offset === 0}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setOffset(offset + limit)}
                    disabled={offset + limit >= data.totalCount}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// Exported pure helpers for unit tests.
export { formatDuration, formatTimestamp };
