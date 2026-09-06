"use client";

import { useSession } from "@/lib/auth-client";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useCallback } from "react";
import { useChatbot } from "@/hooks/useChatbot";
import { trpc } from "@/lib/trpc";
import { getFilePollingInterval } from "@/hooks/file-polling";
import { ChatbotLoadingSkeleton } from "./chatbot-loading-skeleton";
import { ChatbotNotFound } from "./chatbot-not-found";
import { ChatbotHeader } from "./chatbot-header";
import { ChatbotDetailTabs } from "./chatbot-detail-tabs";

const VALID_TABS = [
  "chat",
  "files",
  "web-sources",
  "conversations",
  "analytics",
  "settings",
  "embed",
];

export default function ChatbotDetailPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const chatbotId = typeof params.id === "string" ? params.id : "";
  const { data: session, isPending: sessionLoading } = useSession();

  const tabParam = searchParams.get("tab");
  const activeTab =
    tabParam && VALID_TABS.includes(tabParam) ? tabParam : "chat";

  const handleTabChange = useCallback(
    (value: string) => {
      const next = new URLSearchParams(searchParams.toString());
      if (value === "chat") {
        next.delete("tab");
      } else {
        next.set("tab", value);
      }
      const qs = next.toString();
      router.replace(`/chatbot/${chatbotId}${qs ? `?${qs}` : ""}`, {
        scroll: false,
      });
    },
    [searchParams, router, chatbotId],
  );

  const chat = useChatbot(chatbotId, session);

  // Fetch files associated with this chatbot (will be paginated in ChatbotFilesTab)
  const { isLoading: filesLoading, refetch: refetchFiles } =
    trpc.files.listForChatbot.useQuery(
      { chatbotId, limit: 1, offset: 0 },
      {
        enabled: !!session && !!chatbotId,
        refetchInterval: getFilePollingInterval(),
      },
    );

  // Generate share token mutation
  const utils = trpc.useUtils();
  const generateShareToken = trpc.chatbot.generateShareToken.useMutation({
    onSuccess: async () => {
      await utils.chatbot.get.invalidate({ id: chatbotId });
      await utils.chatbot.getById.invalidate({ id: chatbotId });
    },
    onError: () => {
      // Error handling is done in ShareLinkSection component
    },
  });

  // Loading state
  if (sessionLoading || chat.chatbotLoading) {
    return <ChatbotLoadingSkeleton />;
  }

  // Redirect if not logged in
  if (!session) {
    router.push("/login");
    return null;
  }

  // Not found
  if (!chat.chatbot) {
    return <ChatbotNotFound onBack={() => router.push("/dashboard")} />;
  }

  const chatbot = chat.chatbot;

  return (
    <div className="flex-1 p-4 md:p-6 lg:p-8 min-w-0">
      <div className="max-w-7xl mx-auto space-y-8 overflow-hidden">
        {/* Header */}
        <ChatbotHeader
          name={chatbot.name}
          description={chatbot.description}
          model={chatbot.model}
          sharingEnabled={chatbot.sharingEnabled}
          shareToken={chatbot.shareToken}
          onEnableSharing={() => generateShareToken.mutate({ id: chatbotId })}
          isEnabling={generateShareToken.isPending}
        />

        {/* Tabs */}
        <ChatbotDetailTabs
          activeTab={activeTab}
          onTabChange={handleTabChange}
          chatbotId={chatbotId}
          chatbot={chatbot}
          filesLoading={filesLoading}
          onRefetchFiles={refetchFiles}
          messages={chat.messages}
          status={chat.status}
          currentMessage={chat.currentMessage}
          setCurrentMessage={chat.setCurrentMessage}
          handleSendMessage={chat.handleSendMessage}
          messagesEndRef={
            chat.messagesEndRef as React.RefObject<HTMLDivElement>
          }
          resetChat={chat.resetChat}
          stop={chat.stop}
          showSources={chatbot.showSources ?? false}
          onStudyAttempt={chat.onStudyAttempt}
          studyAttempts={chat.studyAttempts}
        />
      </div>
    </div>
  );
}
