import { useState, useRef, useEffect, useCallback } from "react";
import { useChat as useAIChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { nanoid } from "nanoid";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import type { StudyUIMessage } from "@/server/chat/study-tools";

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
    onError: () => toast.error("Failed to send message. Please try again."),
  });

  const isStreaming =
    chat.status === "submitted" || chat.status === "streaming";
  const isThinking = chat.status === "submitted";

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

  const resetChat = () => {
    // Abort any in-flight stream first: re-keying useChat below discards the old
    // Chat without cancelling its request, so without this the server keeps
    // generating (burning tokens) until the timeout.
    void chat.stop();
    chat.setMessages([]);
    setCurrentMessage("");
    // Start a fresh server-side conversation (matches the prior behavior). The
    // new id also re-keys useChat, so the transport no longer reloads the
    // old conversation's history on the next send.
    setSessionId(nanoid());
  };

  // Auto-scroll on new content.
  useEffect(() => {
    const id = setTimeout(() => {
      const el = messagesEndRef.current;
      if (!el) return;
      const container = el.closest(
        "[data-scroll-container]",
      ) as HTMLElement | null;
      if (container) container.scrollTop = container.scrollHeight;
      else el.scrollIntoView({ behavior: "instant", block: "end" });
    }, 0);
    return () => clearTimeout(id);
  }, [chat.messages]);

  return {
    messages: chat.messages,
    currentMessage,
    setCurrentMessage,
    isStreaming,
    isThinking,
    sendMessage,
    handleSendMessage,
    stop: chat.stop,
    resetChat,
    messagesEndRef,
    chatbot,
    chatbotLoading,
    error,
  };
}
