import { useState, useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";
import type { ChatMessage } from "@/types/database";

type StreamSource = {
  fileName: string;
  chunkIndex: number;
  similarity: number;
};

type StreamData =
  | { type: "metadata"; sessionId?: string; sources?: StreamSource[] }
  | { type: "text"; content: string }
  | { type: "thinking" }
  | { type: "done"; truncated?: boolean; responseTime?: number };

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
  const [isThinking, setIsThinking] = useState(false);
  const streamingContentRef = useRef("");
  // Set when the user cancels mid-stream. Gates handleStreamData so any
  // chunks that arrive after cancellation don't resurrect the streaming UI.
  const cancelledRef = useRef(false);

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
    setIsThinking(false);
    setStreamingContent("");
    streamingContentRef.current = "";
    cancelledRef.current = false;
    sourcesRef.current = [];
  };

  const stopStreaming = () => {
    if (!isStreaming) return;

    const finalContent = streamingContentRef.current;
    const finalSources = [...sourcesRef.current];

    cancelledRef.current = true;
    updateStreamingContent("");
    setIsStreaming(false);
    setIsThinking(false);
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
    // Drop any events that arrive after the user cancelled -- stopStreaming
    // already committed the partial message, we don't want duplicates.
    if (cancelledRef.current) return;

    if (data.type === "metadata") {
      if (data.sources) {
        sourcesRef.current = data.sources;
      }
      if (data.sessionId) {
        setSessionId(data.sessionId);
      }
    } else if (data.type === "text") {
      // First text chunk ends the thinking phase. React bails on identical
      // state so we call unconditionally to avoid a stale-closure trap.
      setIsThinking(false);
      updateStreamingContent((prev) => prev + data.content);
    } else if (data.type === "thinking") {
      // Model is in a reasoning phase. Flip the indicator so the UI doesn't
      // look frozen during long pauses.
      setIsThinking(true);
    } else if (data.type === "done") {
      clearStreamingTimeout();
      setIsThinking(false);

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
          truncated: data.truncated || undefined,
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
    setIsThinking(false);

    // Preserve any partial content already received so the user can see what
    // the model produced before the stream failed. Prior behavior dropped it.
    const partialContent = streamingContentRef.current;
    const finalSources = [...sourcesRef.current];
    updateStreamingContent("");
    sourcesRef.current = [];
    cancelledRef.current = false;

    if (partialContent) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: partialContent,
          sources: finalSources.length > 0 ? finalSources : undefined,
          cancelled: true,
        },
      ]);
    }
  };

  /** Start streaming a message. Call from the hook's sendMessage handler. */
  const startStreaming = () => {
    setIsStreaming(true);
    setIsThinking(false);
    updateStreamingContent("");
    sourcesRef.current = [];
    cancelledRef.current = false;
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
    isThinking,
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
