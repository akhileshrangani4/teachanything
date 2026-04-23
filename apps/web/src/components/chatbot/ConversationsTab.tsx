"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
import {
  formatDuration,
  formatTimestamp,
} from "@/lib/conversation-format";

type ConversationRow =
  RouterOutputs["analytics"]["getConversationsList"]["conversations"][number];

interface ConversationsTabProps {
  chatbotId: string;
}

type SortBy = "recent" | "mostMessages" | "longestDuration";

// Shared shell classes so list view and detail view render at identical
// dimensions. Keeps tab-internal navigation from jumping the layout.
const PANEL_SHELL =
  "flex flex-col h-[calc(100vh-14rem)] min-h-[500px] max-h-[800px]";
const PANEL_CONTENT = "flex flex-1 min-h-0 flex-col gap-4";
// Approx height of a single conversation row (padding + two lines).
// Used to auto-size page limit so rows fill the available panel.
const ROW_HEIGHT_PX = 68;
const MIN_LIMIT = 5;
const MAX_LIMIT = 50;

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
  const [limit, setLimit] = useState(MIN_LIMIT);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Measure the results area and fit as many rows as will fit so the panel
  // doesn't leave whitespace. Re-runs when the viewport resizes.
  useLayoutEffect(() => {
    const el = resultsRef.current;
    if (!el) return;
    const update = () => {
      const rows = Math.floor(el.clientHeight / ROW_HEIGHT_PX);
      const clamped = Math.max(MIN_LIMIT, Math.min(MAX_LIMIT, rows));
      setLimit((prev) => (prev === clamped ? prev : clamped));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Reset pagination when the effective query, sort, or page size changes.
  useEffect(() => {
    setOffset(0);
  }, [debouncedSearch, sortBy, limit]);

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
    <Card className={PANEL_SHELL}>
      <CardHeader className="shrink-0">
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
      <CardContent className={PANEL_CONTENT}>
        <div className="flex gap-2 shrink-0">
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

        <div ref={resultsRef} className="flex flex-1 min-h-0 flex-col">
          <ConversationsResults
            chatbotId={chatbotId}
            search={debouncedSearch}
            sortBy={sortBy}
            limit={limit}
            offset={offset}
            onSelectConversation={setSelectedConversationId}
            onOffsetChange={setOffset}
          />
        </div>
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
      <div className="flex-1 min-h-0 overflow-y-auto divide-y rounded-lg border">
        {Array.from({ length: limit }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between px-4 py-3"
          >
            <div className="min-w-0 flex-1 mr-3 space-y-2">
              <Skeleton className="h-4 w-3/5" />
              <div className="flex items-center gap-3">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 min-h-0 flex-col items-center justify-center text-center">
        <MessageSquare className="h-12 w-12 mb-4 text-red-500 opacity-50" />
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
        <div className="flex flex-1 min-h-0 flex-col items-center justify-center text-center text-muted-foreground">
          <Search className="h-12 w-12 mb-4 opacity-50" />
          <p className="text-lg font-medium">No results found</p>
          <p className="text-sm mt-1">Try a different search term.</p>
        </div>
      );
    }
    return (
      <div className="flex flex-1 min-h-0 flex-col items-center justify-center text-center text-muted-foreground">
        <MessageSquare className="h-12 w-12 mb-4 opacity-50" />
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
    <div className="flex flex-1 min-h-0 flex-col gap-2">
      <div className="flex-1 min-h-0 overflow-y-auto divide-y rounded-lg border">
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
    <Card className={PANEL_SHELL}>
      <CardHeader className="shrink-0">
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
      <CardContent className={PANEL_CONTENT}>
        {isLoading ? (
          <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-2">
            {Array.from({ length: 5 }).map((_, i) => {
              // Alternate student (right-aligned bubble) and assistant
              // (avatar + bubble) to match the live ChatMessage layout.
              const isUser = i % 2 === 0;
              if (isUser) {
                return (
                  <div key={i} className="flex justify-end">
                    <Skeleton className="h-10 w-3/5 max-w-[80%] rounded-lg" />
                  </div>
                );
              }
              return (
                <div key={i} className="flex items-start gap-3">
                  <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                  <Skeleton className="h-20 flex-1 max-w-[85%] rounded-lg" />
                </div>
              );
            })}
          </div>
        ) : error ? (
          <div className="flex flex-1 min-h-0 flex-col items-center justify-center text-center">
            <MessageSquare className="h-12 w-12 mb-4 text-red-500 opacity-50" />
            <p className="text-lg font-medium text-red-600">
              Failed to load messages
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Please try again in a moment.
            </p>
          </div>
        ) : !data || data.messages.length === 0 ? (
          <div className="flex flex-1 min-h-0 flex-col items-center justify-center text-center text-muted-foreground">
            <MessageSquare className="h-12 w-12 mb-4 opacity-50" />
            <p>No messages in this conversation.</p>
          </div>
        ) : (
          <>
            <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-2">
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
              <div className="flex items-center justify-between pt-3 border-t shrink-0">
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
