"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { rowToUIMessage } from "@/server/chat/ui-messages";
import type { StudyResponsePayload } from "@/lib/submit-study-response";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc, type RouterOutputs } from "@/lib/trpc";
import { keepPreviousData } from "@tanstack/react-query";
import {
  MessageSquare,
  Search,
  ArrowLeft,
  Clock,
  Trash2,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { logError } from "@/lib/logger";
import { formatDuration, formatTimestamp } from "@/lib/conversation-format";
import {
  downloadConversationsExport,
  type ExportFormat,
} from "@/lib/export-conversations";

type ConversationRow =
  RouterOutputs["analytics"]["getConversationsList"]["conversations"][number];

interface ConversationsTabProps {
  chatbotId: string;
}

type SortBy = "recent" | "mostMessages" | "longestDuration";

// Shared shell classes so list view and detail view render at identical
// dimensions. Keeps tab-internal navigation from jumping the layout. The
// vertical offset (space above the panel: navbar + tabs + padding) is
// exposed as a CSS var so future chrome changes touch one place.
const PANEL_OFFSET = "14rem";
const PANEL_STYLE = {
  "--panel-offset": PANEL_OFFSET,
} as React.CSSProperties;
const PANEL_SHELL =
  "flex flex-col h-[calc(100vh-var(--panel-offset))] min-h-[500px] max-h-[800px]";
const PANEL_CONTENT = "flex flex-1 min-h-0 flex-col gap-4";
// Approx height of a single conversation row (padding + two lines).
// Used to auto-size page limit so rows fill the available panel.
const ROW_HEIGHT_PX = 68;
const MIN_LIMIT = 5;
const MAX_LIMIT = 50;

// Export format order is fixed here so the README/bundle always lists files
// consistently regardless of the order the professor toggles the checkboxes.
const EXPORT_FORMAT_OPTIONS: Array<{
  value: ExportFormat;
  label: string;
  description: string;
}> = [
  {
    value: "html",
    label: "Visual transcript (HTML)",
    description: "Open in a browser — chat-style, easy to read.",
  },
  {
    value: "csv",
    label: "Spreadsheet (CSV)",
    description: "Open in Excel / Google Sheets for analysis.",
  },
  {
    value: "text",
    label: "Plain text (TXT)",
    description: "Portable transcript for any text editor.",
  },
];

const ALL_EXPORT_FORMATS: ExportFormat[] = EXPORT_FORMAT_OPTIONS.map(
  (o) => o.value,
);

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
  const observerRef = useRef<ResizeObserver | null>(null);

  // Measure the results area and fit as many rows as will fit so the panel
  // doesn't leave whitespace. A callback ref (not useLayoutEffect+useRef) is
  // used so measurement re-attaches every time the list view re-mounts -- e.g.
  // after returning from a conversation detail. The old approach left a stale
  // ResizeObserver bound to the detached node, which fired with height 0 and
  // reset the page size to the minimum (the "10 -> 5 after going back" bug).
  const setResultsRef = useCallback((el: HTMLDivElement | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    if (!el) return;
    const update = () => {
      const rows = Math.floor(el.clientHeight / ROW_HEIGHT_PX);
      if (rows <= 0) return; // ignore detached/zero-height measurements
      const clamped = Math.max(MIN_LIMIT, Math.min(MAX_LIMIT, rows));
      setLimit((prev) => {
        if (prev === clamped) return prev;
        setOffset((prevOffset) => Math.floor(prevOffset / clamped) * clamped);
        return clamped;
      });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    observerRef.current = observer;
  }, []);

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
            Student Chats
          </CardTitle>
          <CardDescription className="mt-1.5">
            Browse your students&apos; chat history with this chatbot.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className={PANEL_CONTENT}>
        <div className="flex gap-2 shrink-0">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search student chats..."
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

function ConversationListView({
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

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allVisibleSelected =
    conversations.length > 0 && conversations.every((c) => selected.has(c.id));

  const toggleAllVisible = () =>
    setSelected((prev) => {
      if (allVisibleSelected) {
        const next = new Set(prev);
        conversations.forEach((c) => next.delete(c.id));
        return next;
      }
      return new Set([...prev, ...conversations.map((c) => c.id)]);
    });

  // Export: `null` = dialog closed; "all" exports every conversation for the
  // chatbot, "selected" exports only the checked ids. Formats default to all.
  const [exportMode, setExportMode] = useState<"all" | "selected" | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormats, setExportFormats] = useState<Set<ExportFormat>>(
    () => new Set(ALL_EXPORT_FORMATS),
  );

  const toggleFormat = (format: ExportFormat) =>
    setExportFormats((prev) => {
      const next = new Set(prev);
      if (next.has(format)) next.delete(format);
      else next.add(format);
      return next;
    });

  const runExport = async () => {
    if (exportMode === null || exportFormats.size === 0) return;
    setIsExporting(true);
    try {
      const conversationIds =
        exportMode === "selected" ? [...selected] : undefined;
      const data = await utils.analytics.exportConversations.fetch({
        chatbotId,
        conversationIds,
      });
      if (data.conversations.length === 0) {
        toast.error("No chat records to export.");
        return;
      }
      downloadConversationsExport(
        data,
        ALL_EXPORT_FORMATS.filter((f) => exportFormats.has(f)),
      );
      const count = data.conversations.length;
      if (data.truncated) {
        toast.warning(
          `Exported the first ${data.maxConversations} chats. Export smaller selections to capture the rest.`,
        );
      } else {
        toast.success(`Exported ${count} chat${count !== 1 ? "s" : ""}.`);
      }
      setExportMode(null);
    } catch (err) {
      logError(err, "[conversations] export failed", { chatbotId });
      toast.error("Export failed. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

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
                onClick={() => setExportMode("selected")}
              >
                <Download className="h-3.5 w-3.5 mr-1" />
                Export selected
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-7"
              onClick={() => setExportMode("all")}
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
            <div
              key={conversation.id}
              className="flex items-start gap-2 px-4 py-3 hover:bg-muted/50 transition-colors"
            >
              <input
                type="checkbox"
                className="h-4 w-4 mt-0.5 shrink-0 cursor-pointer accent-primary"
                checked={selected.has(conversation.id)}
                onChange={() => toggle(conversation.id)}
                aria-label="Select chat"
              />
              <button
                type="button"
                onClick={() => onSelectConversation(conversation.id)}
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
                onClick={() => setPendingIds([conversation.id])}
                aria-label="Delete chat"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <AlertDialog
        open={pendingIds !== null}
        onOpenChange={(open) => {
          if (!open) setPendingIds(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {pendingIds?.length ?? 0} chat
              {(pendingIds?.length ?? 0) !== 1 ? "s" : ""}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the selected student chat
              {(pendingIds?.length ?? 0) !== 1 ? "s" : ""} and all their
              messages. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (pendingIds && pendingIds.length > 0) {
                  deleteMutation.mutate({
                    chatbotId,
                    conversationIds: pendingIds,
                  });
                }
              }}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={exportMode !== null}
        onOpenChange={(open) => {
          if (!open && !isExporting) setExportMode(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Export{" "}
              {exportMode === "selected"
                ? `${selected.size} selected chat${selected.size !== 1 ? "s" : ""}`
                : "all chats"}
            </DialogTitle>
            <DialogDescription>
              Choose the formats to include. A README explaining each file is
              added automatically, and everything downloads as a single .zip.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            {EXPORT_FORMAT_OPTIONS.map((option) => (
              <label
                key={option.value}
                className="flex items-start gap-3 cursor-pointer"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 mt-0.5 shrink-0 cursor-pointer accent-primary"
                  checked={exportFormats.has(option.value)}
                  onChange={() => toggleFormat(option.value)}
                />
                <span className="min-w-0">
                  <span className="text-sm font-medium">{option.label}</span>
                  <span className="block text-xs text-muted-foreground">
                    {option.description}
                  </span>
                </span>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setExportMode(null)}
              disabled={isExporting}
            >
              Cancel
            </Button>
            <Button
              onClick={runExport}
              disabled={isExporting || exportFormats.size === 0}
            >
              {isExporting ? "Exporting..." : "Export"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

  // Group the student's persisted study-tool attempts by toolCallId (already
  // oldest-first) so each read-only tool can show its own attempts. Keyed by
  // toolCallId, so each entry belongs to exactly one tool; the rendering
  // component casts to its own response type. Tool-agnostic.
  const studyAttempts = useMemo(() => {
    const map: Record<string, StudyResponsePayload[]> = {};
    for (const r of data?.studyResponses ?? []) {
      (map[r.toolCallId] ??= []).push(r.response as StudyResponsePayload);
    }
    return map;
  }, [data?.studyResponses]);

  return (
    <Card className={PANEL_SHELL} style={PANEL_STYLE}>
      <CardHeader className="shrink-0">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            aria-label="Back to student chats"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Button>
          <div>
            <CardTitle className="text-lg">Student Chat</CardTitle>
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
              // Conversations typically open with an assistant welcome, so
              // start with the assistant (avatar + bubble) and alternate.
              const isUser = i % 2 === 1;
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
                .filter(
                  (m): m is typeof m & { role: "user" | "assistant" } =>
                    m.role === "user" || m.role === "assistant",
                )
                .map((msg) => (
                  <ChatMessage
                    key={msg.id}
                    message={rowToUIMessage(msg)}
                    showSources
                    readOnly
                    studyAttempts={studyAttempts}
                  />
                ))}
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
