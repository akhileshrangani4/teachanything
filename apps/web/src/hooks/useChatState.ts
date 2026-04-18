import { useState, useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";
import type { ChatMessage } from "@/types/database";

type StreamData = {
  type: string;
  content?: string;
  sessionId?: string;
  sources?: Array<{
    fileName: string;
    chunkIndex: number;
    similarity: number;
  }>;
};

/**
 * Shared hook for managing common chat state, auto-scrolling, and streaming orchestration.
 *
 * Used internally by `useChat` (shared/public) and `useChatbot` (authenticated).
 *
 * @internal
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
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearStreamingTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Auto-scroll to bottom when messages or streaming content changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (messagesEndRef.current) {
        const scrollContainer = messagesEndRef.current.closest(
          "[data-scroll-container]",
        ) as HTMLElement;
        if (scrollContainer) {
          scrollContainer.scrollTop = scrollContainer.scrollHeight;
        } else {
          messagesEndRef.current.scrollIntoView({
            behavior: "instant",
            block: "end",
          });
        }
      }
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [messages, streamingContent]);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => clearStreamingTimeout();
  }, [clearStreamingTimeout]);

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

    const finalContent = streamingContentRef.current;
    const finalSources = [...sourcesRef.current];

    updateStreamingContent("");
    setIsStreaming(false);
    sourcesRef.current = [];

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

  /** Shared onData handler for tRPC streaming subscriptions. */
  const handleStreamData = (data: StreamData) => {
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

      // Guard: if streaming was already stopped (e.g., user cancelled), skip.
      // Uses ref (not state) to avoid stale closure issues in subscription callbacks.
      if (!streamingContentRef.current) return;

      const finalContent = streamingContentRef.current;
      const finalSources = [...sourcesRef.current];

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

      sourcesRef.current = [];
    }
  };

  /** Shared onError handler for tRPC streaming subscriptions. */
  const handleStreamError = () => {
    clearStreamingTimeout();
    toast.error("Failed to send message. Please try again.");
    setIsStreaming(false);
    updateStreamingContent("");
    sourcesRef.current = [];
  };

  /** Start streaming a message. Call from the hook's sendMessage handler. */
  const startStreaming = () => {
    setIsStreaming(true);
    updateStreamingContent("");
    sourcesRef.current = [];
    clearStreamingTimeout();
    timeoutRef.current = setTimeout(() => {
      stopStreaming();
      toast.error("Response timed out. Please try again.");
    }, 300_000); // 5 minutes
  };

  /** Handle form submission. Returns the trimmed message or null if invalid. */
  const prepareSendMessage = (e: React.FormEvent): string | null => {
    e.preventDefault();
    if (!currentMessage.trim() || isStreaming) return null;

    const userMessage = currentMessage;
    setCurrentMessage("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    return userMessage;
  };

  return {
    messages,
    currentMessage,
    setCurrentMessage,
    sessionId,
    isStreaming,
    streamingContent,
    messagesEndRef,
    // Streaming orchestration
    handleStreamData,
    handleStreamError,
    startStreaming,
    prepareSendMessage,
    clearStreamingTimeout,
    resetChat,
    stopStreaming,
  };
}
