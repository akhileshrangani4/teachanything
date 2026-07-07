"use client";

import { useParams } from "next/navigation";
import { useChat } from "@/hooks/useChat";
import { ChatInterface } from "@/components/chat/messages/ChatInterface";
import { EmbedLoading } from "@/components/embed/EmbedLoading";
import { EmbedError } from "@/components/embed/EmbedError";
import { EmbedHeader } from "@/components/embed/EmbedHeader";
import { EmbedFooter } from "@/components/embed/EmbedFooter";
import { useEmbedVisibility } from "@/hooks/useEmbedVisibility";
import { ErrorBoundary } from "@/components/ui/error-boundary";

export default function EmbedWindowPage() {
  const params = useParams();
  const shareToken =
    typeof params.shareToken === "string" ? params.shareToken : "";
  const { isMounted, isVisible, withExitX, close } = useEmbedVisibility();

  const {
    messages,
    currentMessage,
    setCurrentMessage,
    isStreaming,
    isThinking,
    statusLabel,
    streamingContent,
    messagesEndRef,
    chatbot,
    chatbotLoading,
    handleSendMessage,
    resetChat,
    stopStreaming,
    error,
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
        />
      )}

      <div className="flex-1 min-h-0 overflow-hidden">
        <ErrorBoundary>
          <ChatInterface
            messages={messages}
            isStreaming={isStreaming}
            isThinking={isThinking}
            statusLabel={statusLabel}
            streamingContent={streamingContent}
            currentMessage={currentMessage}
            setCurrentMessage={setCurrentMessage}
            handleSendMessage={handleSendMessage}
            messagesEndRef={messagesEndRef as React.RefObject<HTMLDivElement>}
            chatbotName={chatbot.name || "Chatbot"}
            resetChat={resetChat}
            stopStreaming={stopStreaming}
            height="h-full"
            hideHeader={withExitX}
            embedMode={true}
            showSources={chatbot.showSources ?? false}
            shareToken={shareToken}
            // Voice disabled in embeds: getUserMedia() inside a third-party
            // iframe requires the embedding page to set
            // `<iframe allow="microphone">`, which most embedders won't.
            // Rather than ship a half-working mic that fails silently on
            // most sites, the feature stays off here. Re-enable per-embed
            // once we expose an opt-in flag on the share configuration.
            voiceInputEnabled={false}
          />
        </ErrorBoundary>
      </div>
      <EmbedFooter />
    </div>
  );
}
