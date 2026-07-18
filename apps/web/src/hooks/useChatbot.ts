import { useState, useRef, useCallback } from "react";
import { useChat as useAIChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { nanoid } from "nanoid";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { describeChatError } from "@/lib/chat-error-message";
import type { StudyUIMessage } from "@/server/chat/study-tools";
import type { QuizResponse } from "@/lib/quiz";
import { postStudyResponse } from "@/lib/submit-study-response";

/**
 * Chat with an authenticated chatbot (the owner's /chatbot/[id] page), backed
 * by the AI SDK chat transport hitting POST /api/chat.
 *
 * A fresh sessionId is generated per page load (matches the prior behavior --
 * no cross-reload history rehydration in this phase).
 */
export function useChatbot(
  chatbotId: string,
  session: { user: { id: string } } | null,
) {
  const [sessionId, setSessionId] = useState(() => nanoid());
  const [currentMessage, setCurrentMessage] = useState("");
  // The student's own finished quiz attempts this session, by quiz toolCallId,
  // for the chat export. Persistence to the server happens in parallel.
  const [studyAttempts, setStudyAttempts] = useState<
    Record<string, QuizResponse[]>
  >({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: chatbot, isLoading: chatbotLoading } =
    trpc.chatbot.get.useQuery({ id: chatbotId }, { enabled: !!session });

  const chat = useAIChat<StudyUIMessage>({
    id: sessionId,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      prepareSendMessagesRequest({ messages }) {
        return {
          body: {
            message: messages[messages.length - 1],
            sessionId,
            chatbotId,
          },
        };
      },
    }),
    onError: (error) => toast.error(describeChatError(error)),
    experimental_throttle: 50,
  });

  const isStreaming =
    chat.status === "submitted" || chat.status === "streaming";

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

  const onQuizAttempt = useCallback(
    (toolCallId: string, response: QuizResponse) => {
      setStudyAttempts((prev) => ({
        ...prev,
        [toolCallId]: [...(prev[toolCallId] ?? []), response],
      }));
      void postStudyResponse({
        chatbotId,
        sessionId,
        toolCallId,
        answers: response.answers,
      });
    },
    [chatbotId, sessionId],
  );

  const resetChat = () => {
    // Abort any in-flight stream first: re-keying useChat below discards the old
    // Chat without cancelling its request, so without this the server keeps
    // generating (burning tokens) until the timeout.
    void chat.stop();
    chat.setMessages([]);
    setCurrentMessage("");
    setStudyAttempts({});
    // Start a fresh server-side conversation (matches the prior behavior). The
    // new id also re-keys useChat, so the transport no longer reloads the
    // old conversation's history on the next send.
    setSessionId(nanoid());
  };

  return {
    messages: chat.messages,
    currentMessage,
    setCurrentMessage,
    isStreaming,
    handleSendMessage,
    stop: chat.stop,
    resetChat,
    messagesEndRef,
    chatbot,
    chatbotLoading,
    onQuizAttempt,
    studyAttempts,
  };
}
