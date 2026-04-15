import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useChatState } from "./useChatState";

/**
 * Hook for managing chat interactions with an authenticated chatbot.
 *
 * Used when the user is logged in and accessing their own chatbot:
 * - Chatbot detail pages (/chatbot/[id])
 * - Authenticated chatbot interactions
 */
export function useChatbot(
  chatbotId: string,
  session: { user: { id: string } } | null,
) {
  const state = useChatState();

  const [messageToSend, setMessageToSend] = useState<{
    chatbotId: string;
    message: string;
    sessionId?: string;
  } | null>(null);

  const { data: chatbot, isLoading: chatbotLoading } =
    trpc.chatbot.get.useQuery({ id: chatbotId }, { enabled: !!session });

  trpc.chat.sendMessageStream.useSubscription(
    messageToSend ?? { chatbotId: "", message: "", sessionId: undefined },
    {
      enabled: !!messageToSend,
      onData: state.handleStreamData,
      onError: state.handleStreamError,
    },
  );

  const handleSendMessage = (e: React.FormEvent) => {
    const message = state.prepareSendMessage(e);
    if (!message) return;
    state.startStreaming();
    setMessageToSend({
      chatbotId,
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
    streamingContent: state.streamingContent,
    messagesEndRef: state.messagesEndRef,
    chatbot,
    chatbotLoading,
    handleSendMessage,
    resetChat,
    stopStreaming,
  };
}
