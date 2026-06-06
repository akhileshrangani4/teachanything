import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useChatState } from "./useChatState";
import { getMode } from "@/lib/modes/registry";
import type { StructuredMessage } from "@/types/database";

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
    skipConfirm?: boolean;
    forceNormalChat?: boolean;
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

  /** Returns true if the message was accepted and queued, false if rejected. */
  const handleSendText = (text: string): boolean => {
    const message = state.prepareSendText(text);
    if (!message) return false;
    state.startStreaming();
    setMessageToSend({
      chatbotId,
      message,
      sessionId: state.sessionId || undefined,
    });
    return true;
  };

  /**
   * Student clicked "Yes" on a confirm card: dismiss it, append the canonical
   * trigger phrase as a clean user message, and generate (skipConfirm bypasses
   * the gate so the strict detector runs).
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
      chatbotId,
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
      chatbotId,
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
  };
}
