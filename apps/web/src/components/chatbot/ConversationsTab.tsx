"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import {
  MessageSquare,
  Search,
  ArrowLeft,
  Clock,
  User,
  Bot,
  FileText,
  Loader2,
} from "lucide-react";
import { Markdown } from "@/components/ui/markdown";

interface ConversationsTabProps {
  chatbotId: string;
}

type SortBy = "recent" | "mostMessages" | "longestDuration";

function formatDuration(firstAt: Date | null, lastAt: Date | null): string {
  if (!firstAt || !lastAt) return "-";
  const ms = new Date(lastAt).getTime() - new Date(firstAt).getTime();
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
  return `${Math.round(ms / 3600000)}h ${Math.round((ms % 3600000) / 60000)}m`;
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

export function ConversationsTab({ chatbotId }: ConversationsTabProps) {
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("recent");
  const [offset, setOffset] = useState(0);
  const limit = 20;

  const handleSearch = () => {
    setSelectedConversationId(null);
    setActiveSearch(searchQuery);
    setOffset(0);
  };

  const clearSearch = () => {
    setSearchQuery("");
    setActiveSearch("");
    setOffset(0);
    setSelectedConversationId(null);
  };

  if (selectedConversationId) {
    return (
      <ConversationDetail
        chatbotId={chatbotId}
        conversationId={selectedConversationId}
        onBack={() => setSelectedConversationId(null)}
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Conversations
            </CardTitle>
            <CardDescription className="mt-1.5">
              Browse student conversations with your chatbot.
            </CardDescription>
          </div>
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
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="pl-9"
            />
          </div>
          <Button
            variant="outline"
            onClick={handleSearch}
            disabled={!searchQuery}
          >
            Search
          </Button>
          {activeSearch && (
            <Button variant="ghost" onClick={clearSearch}>
              Clear
            </Button>
          )}
          <Select
            value={sortBy}
            onValueChange={(v) => {
              setSortBy(v as SortBy);
              setOffset(0);
            }}
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

        {activeSearch ? (
          <SearchResults
            chatbotId={chatbotId}
            query={activeSearch}
            limit={limit}
            offset={offset}
            onSelectConversation={setSelectedConversationId}
            onOffsetChange={setOffset}
          />
        ) : (
          <ConversationsList
            chatbotId={chatbotId}
            sortBy={sortBy}
            limit={limit}
            offset={offset}
            onSelectConversation={setSelectedConversationId}
            onOffsetChange={setOffset}
          />
        )}
      </CardContent>
    </Card>
  );
}

function ConversationsList({
  chatbotId,
  sortBy,
  limit,
  offset,
  onSelectConversation,
  onOffsetChange,
}: {
  chatbotId: string;
  sortBy: SortBy;
  limit: number;
  offset: number;
  onSelectConversation: (id: string) => void;
  onOffsetChange: (offset: number) => void;
}) {
  const { data, isLoading, error } = trpc.analytics.getConversationsList.useQuery({
    chatbotId,
    sortBy,
    limit,
    offset,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <MessageSquare className="h-12 w-12 mx-auto mb-4 text-red-500 opacity-50" />
        <p className="text-lg font-medium text-red-600">Failed to load conversations</p>
        <p className="text-sm text-muted-foreground mt-1">{error.message}</p>
      </div>
    );
  }

  if (!data || data.conversations.length === 0) {
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

function SearchResults({
  chatbotId,
  query,
  limit,
  offset,
  onSelectConversation,
  onOffsetChange,
}: {
  chatbotId: string;
  query: string;
  limit: number;
  offset: number;
  onSelectConversation: (id: string) => void;
  onOffsetChange: (offset: number) => void;
}) {
  const { data, isLoading, error } = trpc.analytics.searchConversations.useQuery({
    chatbotId,
    query,
    limit,
    offset,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <Search className="h-12 w-12 mx-auto mb-4 text-red-500 opacity-50" />
        <p className="text-lg font-medium text-red-600">Search failed</p>
        <p className="text-sm text-muted-foreground mt-1">{error.message}</p>
      </div>
    );
  }

  if (!data || data.conversations.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="text-lg font-medium">No results found</p>
        <p className="text-sm mt-1">Try a different search term.</p>
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
  conversations: Array<{
    id: string;
    sessionId: string;
    metadata: { userAgent?: string; referrer?: string } | null;
    createdAt: Date;
    messageCount: number;
    preview: string | null;
    firstMessageAt: Date | null;
    lastMessageAt: Date | null;
  }>;
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

  const { data, isLoading, error } = trpc.analytics.getConversationMessages.useQuery({
    chatbotId,
    conversationId,
    limit,
    offset,
  });

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
                Started {formatTimestamp(data.conversation.createdAt)}
                {" \u00b7 "}
                Session: {data.conversation.sessionId.slice(0, 8)}...
              </CardDescription>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 text-red-500 opacity-50" />
            <p className="text-lg font-medium text-red-600">Failed to load messages</p>
            <p className="text-sm text-muted-foreground mt-1">{error.message}</p>
          </div>
        ) : !data || data.messages.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No messages in this conversation.</p>
          </div>
        ) : (
          <>
            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
              {data.messages.map((msg) => {
                const metadata = msg.metadata;
                const isUser = msg.role === "user";

                return (
                  <div key={msg.id} className="flex gap-3">
                    <div className="shrink-0 mt-1">
                      {isUser ? (
                        <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                      ) : (
                        <div className="h-7 w-7 rounded-full bg-secondary flex items-center justify-center">
                          <Bot className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-medium">
                          {isUser ? "Student" : "Assistant"}
                        </span>
                        <span>{formatTimestamp(msg.createdAt)}</span>
                        {metadata?.responseTime != null && (
                          <Badge
                            variant="outline"
                            className="text-xs px-1.5 py-0"
                          >
                            {metadata.responseTime}ms
                          </Badge>
                        )}
                      </div>
                      <div className="rounded-lg border bg-card px-3 py-2 text-sm">
                        {isUser ? (
                          <p className="whitespace-pre-wrap break-words">
                            {msg.content}
                          </p>
                        ) : (
                          <Markdown>{msg.content}</Markdown>
                        )}
                      </div>
                      {metadata?.sources && metadata.sources.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {metadata.sources.map((source) => (
                            <Badge
                              key={`${source.fileName}-${source.chunkIndex}`}
                              variant="secondary"
                              className="text-xs"
                            >
                              <FileText className="h-3 w-3 mr-1" />
                              {source.fileName}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
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
