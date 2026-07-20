import { useState, useRef, useCallback } from "react";
import { useChat as useAIChat } from "@ai-sdk/react";
import { DefaultChatTransport, type ChatStatus } from "ai";
import { nanoid } from "nanoid";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { describeChatError } from "@/lib/chat-error-message";
import type { StudyUIMessage } from "@/server/chat/study-tools";
import {
  postStudyResponse,
  type StudyResponsePayload,
} from "@/lib/submit-study-response";

/**
 * Chat with a shared/public chatbot (share-token pages + embed widget), backed
 * by the AI SDK chat transport hitting POST /api/chat/shared.
 *
 * A fresh sessionId is generated per page load (matches the prior behavior --
 * no cross-reload history rehydration in this phase).
 */
export function useChat(shareToken: string) {
  const [sessionId, setSessionId] = useState(() => nanoid());
  const [currentMessage, setCurrentMessage] = useState("");
  // The student's own finished study-tool responses this session, by tool
  // toolCallId, for the chat export. Persistence to the server runs in parallel.
  const [studyAttempts, setStudyAttempts] = useState<
    Record<string, StudyResponsePayload[]>
  >({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    data: chatbot,
    isLoading: chatbotLoading,
    error,
  } = trpc.chatbot.getByShareToken.useQuery(
    { shareToken },
    { retry: false, refetchOnWindowFocus: false },
  );

  const chat = useAIChat<StudyUIMessage>({
    id: sessionId,
    transport: new DefaultChatTransport({
      api: "/api/chat/shared",
      prepareSendMessagesRequest({ messages }) {
        return {
          body: {
            message: messages[messages.length - 1],
            sessionId,
            shareToken,
          },
        };
      },
    }),
    onError: (error) => toast.error(describeChatError(error)),
    experimental_throttle: 50,
  });

  const isStreaming =
    chat.status === "submitted" || chat.status === "streaming";
  // Annotate against the top-level `ai` package so the hook's inferred return
  // type doesn't reference @ai-sdk/react's nested copy (TS2742, not portable).
  const status: ChatStatus = chat.status;

  const sendMessage = useCallback(
    (text: string): boolean => {
      if (!text.trim() || isStreaming) return false;
      void chat.sendMessage({ text });
      return true;
    },
    [chat, isStreaming],
  );

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (sendMessage(currentMessage)) setCurrentMessage("");
  };

  const onStudyAttempt = useCallback(
    (toolCallId: string, response: StudyResponsePayload) => {
      setStudyAttempts((prev) => ({
        ...prev,
        [toolCallId]: [...(prev[toolCallId] ?? []), response],
      }));
      void postStudyResponse({ shareToken, sessionId, toolCallId, response });
    },
    [shareToken, sessionId],
  );

  const resetChat = () => {
    // Abort any in-flight stream first: re-keying useChat below discards the old
    // Chat without cancelling its request, so without this the server keeps
    // generating (burning tokens) until the timeout.
    void chat.stop();
    chat.setMessages([]);
    setCurrentMessage("");
    setStudyAttempts({});
    // Start a fresh server-side conversation (matches the prior behavior). The
    // new id also re-keys useChat, so the transport no longer reloads the
    // old conversation's history on the next send.
    setSessionId(nanoid());
  };

  return {
    messages: chat.messages,
    currentMessage,
    setCurrentMessage,
    isStreaming,
    status,
    handleSendMessage,
    stop: chat.stop,
    resetChat,
    messagesEndRef,
    chatbot,
    chatbotLoading,
    error,
    onStudyAttempt,
    studyAttempts,
  };
}
