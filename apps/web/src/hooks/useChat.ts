import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useChatState } from "./useChatState";

/**
 * Hook for managing chat interactions with a shared/public chatbot.
 *
 * Used when accessing a chatbot via a share token (public link):
 * - Public shared chatbot pages (/chat/[shareToken])
 * - Embedded chatbot widgets
 */
export function useChat(shareToken: string) {
  const state = useChatState();

  const [messageToSend, setMessageToSend] = useState<{
    shareToken: string;
    message: string;
    sessionId?: string;
  } | null>(null);

  const {
    data: chatbot,
    isLoading: chatbotLoading,
    error: chatbotError,
  } = trpc.chatbot.getByShareToken.useQuery(
    { shareToken },
    { retry: false, refetchOnWindowFocus: false },
  );

  trpc.chat.sendSharedMessageStream.useSubscription(
    messageToSend ?? { shareToken: "", message: "", sessionId: undefined },
    {
      enabled: !!messageToSend,
      // Events arrive as tracked envelopes ({ id, data }) so the server can
      // tell a reconnect replay from a fresh message; unwrap the payload.
      onData: (envelope) => state.handleStreamData(envelope.data),
      onError: state.handleStreamError,
    },
  );

  const handleSendMessage = (e: React.FormEvent) => {
    const message = state.prepareSendMessage(e);
    if (!message) return;
    state.startStreaming();
    setMessageToSend({
      shareToken,
      message,
      sessionId: state.sessionId || undefined,
    });
  };

  const resetChat = () => {
    state.resetChat();
    setMessageToSend(null);
  };

  const stopStreaming = () => {
    state.clearStreamingTimeout();
    setMessageToSend(null);
    state.stopStreaming();
  };

  return {
    messages: state.messages,
    currentMessage: state.currentMessage,
    setCurrentMessage: state.setCurrentMessage,
    isStreaming: state.isStreaming,
    isThinking: state.isThinking,
    statusLabel: state.statusLabel,
    streamingContent: state.streamingContent,
    messagesEndRef: state.messagesEndRef,
    chatbot,
    chatbotLoading,
    handleSendMessage,
    resetChat,
    stopStreaming,
    error: chatbotError,
  };
}
