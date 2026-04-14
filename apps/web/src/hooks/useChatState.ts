import { useState, useRef, useEffect } from "react";
import type { ChatMessage } from "@/types/database";

/**
 * Shared hook for managing common chat state and auto-scrolling behavior.
 *
 * This hook encapsulates the shared state management logic used by both
 * `useChat` (shared/public chatbots) and `useChatbot` (authenticated chatbots).
 *
 * It provides:
 * - Message state management
 * - Auto-scroll to bottom functionality
 * - Streaming state management
 * - Session ID tracking
 * - Source references for RAG citations
 *
 * @returns Shared chat state and reset function
 *
 * @internal This hook is used internally by useChat and useChatbot hooks.
 */
export function useChatState() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentMessage, setCurrentMessage] = useState("");
  const [sessionId, setSessionId] = useState<string>("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const streamingContentRef = useRef("");

  const updateStreamingContent = (
    updater: string | ((prev: string) => string),
  ) => {
    setStreamingContent((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      streamingContentRef.current = next;
      return next;
    });
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sourcesRef = useRef<
    Array<{ fileName: string; chunkIndex: number; similarity: number }>
  >([]);

  // Auto-scroll to bottom when messages or streaming content changes
  useEffect(() => {
    // Use a small delay to ensure DOM is updated
    const timeoutId = setTimeout(() => {
      if (messagesEndRef.current) {
        // Find the scrollable parent container
        const scrollContainer = messagesEndRef.current.closest(
          '[class*="overflow-y-auto"]',
        ) as HTMLElement;
        if (scrollContainer) {
          // Scroll the container to bottom
          scrollContainer.scrollTop = scrollContainer.scrollHeight;
        } else {
          // Fallback to scrollIntoView
          messagesEndRef.current.scrollIntoView({
            behavior: "instant",
            block: "end",
          });
        }
      }
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [messages, streamingContent]);

  const resetChat = () => {
    setMessages([]);
    setCurrentMessage("");
    setSessionId("");
    setIsStreaming(false);
    setStreamingContent("");
    streamingContentRef.current = "";
    sourcesRef.current = [];
  };

  const stopStreaming = () => {
    if (!isStreaming) return;

    // Finalize the current streaming content as a message (read from ref to avoid stale closure)
    const finalContent = streamingContentRef.current;
    const finalSources = [...sourcesRef.current];

    // Clear streaming state
    setStreamingContent("");
    setIsStreaming(false);
    sourcesRef.current = [];

    // Add the cancelled message (even if empty content)
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: finalContent,
        sources: finalSources.length > 0 ? finalSources : undefined,
        cancelled: true,
      },
    ]);
  };

  return {
    messages,
    setMessages,
    currentMessage,
    setCurrentMessage,
    sessionId,
    setSessionId,
    isStreaming,
    setIsStreaming,
    streamingContent,
    setStreamingContent,
    streamingContentRef,
    updateStreamingContent,
    messagesEndRef,
    sourcesRef,
    resetChat,
    stopStreaming,
  };
}
