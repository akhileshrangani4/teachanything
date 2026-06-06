import { useState, useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";
import type { ChatMessage, StructuredMessage } from "@/types/database";
import { STRUCTURED_MODES } from "@/lib/modes/registry";

type StreamSource = {
  fileName: string;
  chunkIndex: number;
  similarity: number;
};

type StreamData =
  | { type: "metadata"; sessionId?: string; sources?: StreamSource[] }
  | { type: "text"; content: string }
  | { type: "thinking" }
  | { type: "structured"; mode: string; payload: unknown }
  | {
      type: "confirm";
      mode: string;
      label: string;
      topic: string;
      originalMessage: string;
    }
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
    } else if (data.type === "structured") {
      // A structured mode (quiz/flashcards/test/mindmap) finalizes the message
      // itself: no text was streamed, so commit the assistant message here and
      // end the streaming UI. A trailing `done` event is harmless -- it no-ops
      // because streamingContentRef is empty. The matching registry mode
      // validates the payload and produces the human-readable summary; an
      // unknown mode id is dropped rather than rendered.
      const mode = STRUCTURED_MODES.find((m) => m.id === data.mode);
      if (!mode) {
        // Unknown mode id (client/server version skew). Reset the streaming UI
        // instead of leaving it spinning until the 5-minute timeout, and tell
        // the user, matching the safeParse-failure branch below.
        clearStreamingTimeout();
        setIsThinking(false);
        updateStreamingContent("");
        setIsStreaming(false);
        toast.error("Couldn't display that response. Please try again.");
        return;
      }

      const parsed = mode.schema.safeParse(data.payload);
      if (!parsed.success) {
        // The server validated this payload before sending, so a client-side
        // failure means a schema/version mismatch. Don't drop it silently --
        // tell the user and end the streaming UI so they can retry.
        clearStreamingTimeout();
        setIsThinking(false);
        updateStreamingContent("");
        setIsStreaming(false);
        toast.error("Couldn't display that response. Please try again.");
        return;
      }

      clearStreamingTimeout();
      setIsThinking(false);
      updateStreamingContent("");
      setIsStreaming(false);

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: mode.summarize(parsed.data),
          messageType: mode.id as StructuredMessage["messageType"],
          structured: parsed.data as ChatMessage["structured"],
        },
      ]);

      sourcesRef.current = [];
    } else if (data.type === "confirm") {
      // Confirm gate: the server eager-detected a study-tool request but didn't
      // generate. Render an ephemeral Yes/No card instead. No content streamed,
      // so commit the card message and end the streaming UI here; a trailing
      // `done` no-ops because streamingContentRef is empty.
      clearStreamingTimeout();
      setIsThinking(false);
      updateStreamingContent("");
      setIsStreaming(false);

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "",
          confirm: {
            mode: data.mode as StructuredMessage["messageType"],
            label: data.label,
            topic: data.topic,
            originalMessage: data.originalMessage,
          },
        },
      ]);

      sourcesRef.current = [];
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

  /**
   * Queue an arbitrary text message programmatically (e.g. a test's written
   * answers submitted from its results screen). Mirrors prepareSendMessage's
   * state updates but takes a string instead of a form event. Returns the
   * message, or null if empty or a stream is already in flight.
   */
  const prepareSendText = (text: string): string | null => {
    const trimmed = text.trim();
    if (!trimmed) return null;
    if (isStreaming) {
      // Unlike the input box (which is disabled mid-stream), a programmatic
      // send -- e.g. submitting a test's written answers -- has no visible
      // disabled state, so surface why nothing happened.
      toast.error("Please wait for the current response to finish.");
      return null;
    }
    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    return trimmed;
  };

  /**
   * Dismiss the pending confirm card (the most recent assistant message carrying
   * a `confirm` payload). Called when the student clicks Yes or No so the card
   * doesn't linger alongside the answer that follows.
   */
  const resolveConfirm = () => {
    setMessages((prev) => prev.filter((m) => !m.confirm));
  };

  return {
    resolveConfirm,
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
    prepareSendText,
    clearStreamingTimeout,
    resetChat,
    stopStreaming,
  };
}
