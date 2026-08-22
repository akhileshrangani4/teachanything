"use client";

import { useEffect } from "react";
import { MessageSquare, Search } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { keepPreviousData } from "@tanstack/react-query";
import { logError } from "@/lib/logger";
import type { SortBy } from "./constants";
import { ConversationListView } from "./conversation-list-view";

export function ConversationsResults({
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
          <div key={i} className="flex items-center justify-between px-4 py-3">
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
          Failed to load student chats
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
        <p className="text-lg font-medium">No student chats yet</p>
        <p className="text-sm mt-1">
          Student chats will appear here when students start using this chatbot.
        </p>
      </div>
    );
  }

  return (
    <ConversationListView
      chatbotId={chatbotId}
      conversations={data.conversations}
      totalCount={data.totalCount}
      limit={limit}
      offset={offset}
      onSelectConversation={onSelectConversation}
      onOffsetChange={onOffsetChange}
    />
  );
}
