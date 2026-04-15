import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useChatState } from "./useChatState";

/**
 * Hook for managing chat interactions with an authenticated chatbot.
 *
 * This hook is used when the user is logged in and accessing their own chatbot.
 * It requires authentication and is used for:
 * - Chatbot detail pages (/chatbot/[id]) - when the owner is viewing their chatbot
 * - Authenticated chatbot interactions
 *
 * @param chatbotId - The ID of the chatbot (from the database)
 * @param session - The current user session (must be authenticated)
 * @returns Chat state and handlers for authenticated chatbot interactions
 *
 * @example
 * ```tsx
 * const { messages, handleSendMessage, chatbot } = useChatbot(chatbotId, session);
 * ```
 */
export function useChatbot(
  chatbotId: string,
  session: { user: { id: string } } | null,
) {
  const {
    messages,
    setMessages,
    currentMessage,
    setCurrentMessage,
    sessionId,
    setSessionId,
    isStreaming,
    setIsStreaming,
    streamingContent,
    streamingContentRef,
    updateStreamingContent,
    messagesEndRef,
    sourcesRef,
    resetChat: resetChatState,
    stopStreaming: stopStreamingState,
  } = useChatState();

  // State for triggering subscription
  const [messageToSend, setMessageToSend] = useState<{
    chatbotId: string;
    message: string;
    sessionId?: string;
  } | null>(null);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearStreamingTimeout = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  // Fetch chatbot details
  const { data: chatbot, isLoading: chatbotLoading } =
    trpc.chatbot.get.useQuery({ id: chatbotId }, { enabled: !!session });

  // tRPC subscription for streaming messages
  trpc.chat.sendMessageStream.useSubscription(
    messageToSend ?? { chatbotId: "", message: "", sessionId: undefined },
    {
      enabled: !!messageToSend,
      onData: (data: {
        type: string;
        content?: string;
        sessionId?: string;
        sources?: Array<{
          fileName: string;
          chunkIndex: number;
          similarity: number;
        }>;
      }) => {
        if (data.type === "metadata") {
          if (data.sources) {
            sourcesRef.current = data.sources;
          }
          if (data.sessionId) {
            setSessionId(data.sessionId);
          }
        } else if (data.type === "text") {
          updateStreamingContent((prev) => prev + (data.content || ""));
        } else if (data.type === "done") {
          clearStreamingTimeout();

          // Guard: if streaming was already stopped (e.g., user cancelled), skip
          if (!streamingContentRef.current && !isStreaming) return;

          // Finalize the message (read from ref to avoid stale closure)
          const finalContent = streamingContentRef.current;
          const finalSources = [...sourcesRef.current];

          // Clear streaming content immediately to prevent duplicate display
          updateStreamingContent("");
          setIsStreaming(false);

          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: finalContent,
              sources: finalSources.length > 0 ? finalSources : undefined,
            },
          ]);

          // Clear other state
          setMessageToSend(null);
          sourcesRef.current = [];
        }
      },
      onError: () => {
        clearStreamingTimeout();
        toast.error("Failed to send message. Please try again.");
        setIsStreaming(false);
        updateStreamingContent("");
        setMessageToSend(null);
        sourcesRef.current = [];
      },
    },
  );

  // Send message function
  const sendMessageWithStreaming = (message: string) => {
    setIsStreaming(true);
    updateStreamingContent("");
    sourcesRef.current = [];

    clearStreamingTimeout();
    timeoutRef.current = setTimeout(() => {
      setMessageToSend(null);
      stopStreamingState();
      toast.error("Response timed out. Please try again.");
    }, 300_000); // 5 minutes

    setMessageToSend({
      chatbotId,
      message,
      sessionId: sessionId || undefined,
    });
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentMessage.trim() || isStreaming) return;

    const userMessage = currentMessage;
    setCurrentMessage("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);

    sendMessageWithStreaming(userMessage);
  };

  const resetChat = () => {
    resetChatState();
    setMessageToSend(null);
  };

  const stopStreaming = () => {
    clearStreamingTimeout();
    setMessageToSend(null);
    stopStreamingState();
  };

  // Clean up timeout on unmount to prevent state updates after unmount
  useEffect(() => {
    return () => clearStreamingTimeout();
  }, []);

  return {
    messages,
    currentMessage,
    setCurrentMessage,
    isStreaming,
    streamingContent,
    messagesEndRef,
    chatbot,
    chatbotLoading,
    handleSendMessage,
    resetChat,
    stopStreaming,
  };
}
