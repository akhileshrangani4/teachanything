"use client";

import { useParams } from "next/navigation";
import { useChat } from "@/hooks/useChat";
import { ChatInterface } from "@/components/chat/messages/ChatInterface";
import { EmbedLoading } from "@/components/embed/EmbedLoading";
import { EmbedError } from "@/components/embed/EmbedError";
import { EmbedHeader } from "@/components/embed/EmbedHeader";
import { EmbedFooter } from "@/components/embed/EmbedFooter";
import { useEmbedVisibility } from "@/hooks/useEmbedVisibility";
import { useEmbedVoice } from "@/hooks/useEmbedVoice";
import { ErrorBoundary } from "@/components/ui/error-boundary";

export default function EmbedWindowPage() {
  const params = useParams();
  const shareToken =
    typeof params.shareToken === "string" ? params.shareToken : "";
  const { isMounted, isVisible, withExitX, close } = useEmbedVisibility();
  const voiceInputEnabled = useEmbedVoice();

  const {
    messages,
    currentMessage,
    setCurrentMessage,
    isStreaming,
    messagesEndRef,
    chatbot,
    chatbotLoading,
    handleSendMessage,
    resetChat,
    stop,
    error,
    onQuizAttempt,
    studyAttempts,
  } = useChat(shareToken);

  if (!isMounted || chatbotLoading) {
    return <EmbedLoading />;
  }

  if (error || !chatbot) {
    return (
      <EmbedError
        message={
          error?.message === "Chatbot not found or sharing is disabled"
            ? "This chatbot is no longer available. The owner has disabled sharing."
            : "This chatbot is no longer available. The owner may have disabled sharing or the link may be invalid."
        }
      />
    );
  }

  if (!isVisible) {
    return null;
  }

  return (
    <div className="w-full h-full flex flex-col bg-background overflow-hidden">
      {withExitX && (
        <EmbedHeader
          chatbotName={chatbot.name || "Chatbot"}
          messagesCount={messages.length}
          isStreaming={isStreaming}
          onReset={resetChat}
          onClose={close}
          messages={messages}
          studyAttempts={studyAttempts}
        />
      )}

      <div className="flex-1 min-h-0 overflow-hidden">
        <ErrorBoundary>
          <ChatInterface
            messages={messages}
            isStreaming={isStreaming}
            currentMessage={currentMessage}
            setCurrentMessage={setCurrentMessage}
            handleSendMessage={handleSendMessage}
            messagesEndRef={messagesEndRef as React.RefObject<HTMLDivElement>}
            chatbotName={chatbot.name || "Chatbot"}
            resetChat={resetChat}
            stop={stop}
            height="h-full"
            hideHeader={withExitX}
            embedMode={true}
            showSources={chatbot.showSources ?? false}
            shareToken={shareToken}
            // Voice in embeds is opt-in: getUserMedia() inside a
            // third-party iframe only works when the embedding page sets
            // `<iframe allow="microphone">`. Current embed snippets carry
            // that attribute plus a `voice=1` URL param; useEmbedVoice
            // requires the param and, where the browser exposes the
            // Permissions Policy API, verifies the delegation actually
            // survived (some CMS editors strip iframe attributes). Older
            // pasted embeds have neither and stay text-only rather than
            // showing a mic that can never get permission.
            voiceInputEnabled={voiceInputEnabled}
            onQuizAttempt={onQuizAttempt}
            studyAttempts={studyAttempts}
          />
        </ErrorBoundary>
      </div>
      <EmbedFooter />
    </div>
  );
}
