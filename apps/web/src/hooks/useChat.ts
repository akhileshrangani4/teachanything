import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useChatState } from "./useChatState";
import { getMode } from "@/lib/modes/registry";
import type { StructuredMessage } from "@/types/database";

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
    skipConfirm?: boolean;
    forceNormalChat?: boolean;
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
      onData: state.handleStreamData,
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

  /** Returns true if the message was accepted and queued, false if rejected. */
  const handleSendText = (text: string): boolean => {
    const message = state.prepareSendText(text);
    if (!message) return false;
    state.startStreaming();
    setMessageToSend({
      shareToken,
      message,
      sessionId: state.sessionId || undefined,
    });
    return true;
  };

  /**
   * Student clicked "Yes" on a confirm card: dismiss it, append the mode's
   * canonical trigger phrase as a clean user message, and generate (skipConfirm
   * bypasses the gate so the strict detector runs on a phrase that's guaranteed
   * to match).
   */
  const confirmYes = (
    mode: StructuredMessage["messageType"],
    topic: string,
  ) => {
    state.resolveConfirm();
    const resolved = getMode(mode);
    if (!resolved) return;
    const message = state.prepareSendText(resolved.canonicalTrigger(topic));
    if (!message) return;
    state.startStreaming();
    setMessageToSend({
      shareToken,
      message,
      sessionId: state.sessionId || undefined,
      skipConfirm: true,
    });
  };

  /**
   * Student clicked "No": dismiss the card and answer their ORIGINAL message as
   * normal chat. The original user message is already in history, so we don't
   * re-append it -- forceNormalChat just bypasses detection on the server.
   */
  const confirmNo = (originalMessage: string) => {
    state.resolveConfirm();
    state.startStreaming();
    setMessageToSend({
      shareToken,
      message: originalMessage,
      sessionId: state.sessionId || undefined,
      forceNormalChat: true,
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
    streamingContent: state.streamingContent,
    messagesEndRef: state.messagesEndRef,
    chatbot,
    chatbotLoading,
    handleSendMessage,
    handleSendText,
    confirmYes,
    confirmNo,
    resetChat,
    stopStreaming,
    error: chatbotError,
  };
}
