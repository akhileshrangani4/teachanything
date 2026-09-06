"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChatMessage } from "@/components/chat/messages/ChatMessage";
import { rowToUIMessage } from "@/lib/chat/ui-messages";
import type { StudyResponsePayload } from "@/lib/submit-study-response";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { logError } from "@/lib/logger";
import { formatTimestamp } from "@/lib/conversation-format";
import { PANEL_CONTENT, PANEL_SHELL, PANEL_STYLE } from "./constants";

export function ConversationDetail({
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
