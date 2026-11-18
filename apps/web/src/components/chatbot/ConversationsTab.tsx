"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MessageSquare, Search } from "lucide-react";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  PANEL_CONTENT,
  PANEL_SHELL,
  PANEL_STYLE,
  type SortBy,
} from "./conversations-tab/constants";
import { usePanelRows } from "./conversations-tab/use-panel-rows";
import { ConversationsResults } from "./conversations-tab/conversations-results";
import { ConversationDetail } from "./conversations-tab/conversation-detail";
import { useTranslation } from "react-i18next";

interface ConversationsTabProps {
  chatbotId: string;
}

export function ConversationsTab({ chatbotId }: ConversationsTabProps) {
  const { t } = useTranslation();
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(null);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebouncedValue(searchQuery.trim(), 300);
  const [sortBy, setSortBy] = useState<SortBy>("recent");
  const [offset, setOffset] = useState(0);

  const { limit, setResultsRef } = usePanelRows(setOffset);

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
    <Card className={PANEL_SHELL} style={PANEL_STYLE}>
      <CardHeader className="shrink-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            {t("conversations.title")}
          </CardTitle>
          <CardDescription className="mt-1.5">
            {t("conversations.description")}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className={PANEL_CONTENT}>
        <div className="flex gap-2 shrink-0">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("conversations.searchPlaceholder")}
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
              <SelectItem value="recent">
                {t("conversations.sort.recent")}
              </SelectItem>
              <SelectItem value="mostMessages">
                {t("conversations.sort.mostMessages")}
              </SelectItem>
              <SelectItem value="longestDuration">
                {t("conversations.sort.longestDuration")}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div ref={setResultsRef} className="flex flex-1 min-h-0 flex-col">
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
