"use client";

import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Bot, FileText, MessageSquare, Plus } from "lucide-react";
import { CreateChatbotDialog } from "@/components/dashboard/chatbots/CreateChatbotDialog";
import { StatCard } from "@/components/dashboard/StatCard";
import { MessagesChart } from "@/components/dashboard/MessagesChart";
import { useTranslation } from "react-i18next";

export default function DashboardPage() {
  const { t } = useTranslation();
  // Fetch chatbots
  const {
    data: chatbots,
    isLoading: chatbotsLoading,
    refetch,
  } = trpc.chatbot.list.useQuery();

  const [dateOffset, setDateOffset] = useState(0); // Days to offset from today

  // Fetch analytics with offset
  const { data: messageData, isLoading: messagesLoading } =
    trpc.analytics.getTotalMessagesPerMonth.useQuery({
      offsetDays: dateOffset,
    });

  // Fetch total files count
  const { data: filesData } = trpc.files.getTotalCount.useQuery();

  const handlePreviousPeriod = () => {
    const hasReachedAccountCreation =
      messageData?.accountCreatedAt &&
      messageData?.startDate &&
      new Date(messageData.startDate).getTime() <=
        new Date(messageData.accountCreatedAt).getTime();

    if (!hasReachedAccountCreation) {
      setDateOffset((prev) => prev + 30);
    }
  };

  const handleNextPeriod = () => {
    setDateOffset((prev) => Math.max(0, prev - 30));
  };

  // Calculate total messages
  const totalMessages =
    messageData?.data?.reduce(
      (sum: number, item: { count: number }) => sum + item.count,
      0,
    ) || 0;

  return (
    <div className="flex-1 p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
          <div>
            <h1 className="text-4xl font-bold text-foreground tracking-tight">
              {t("dashboard.title")}
            </h1>
            <p className="text-muted-foreground mt-2 text-lg">
              {t("dashboard.subtitle")}
            </p>
          </div>
          <CreateChatbotDialog
            onSuccess={refetch}
            trigger={
              <Button
                size="lg"
                className="shadow-sm hover:shadow-md transition-shadow"
              >
                <Plus className="h-4 w-4 mr-2" />
                {t("chatbots.list.newChatbot")}
              </Button>
            }
          />
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          <StatCard
            title={t("dashboard.stats.totalChatbots")}
            value={chatbots?.totalCount || 0}
            description={t("dashboard.stats.activeChatbots")}
            icon={Bot}
            iconColor="text-primary"
            iconBgColor="bg-primary/10"
            isLoading={chatbotsLoading}
          />

          <StatCard
            title={t("dashboard.stats.totalMessages")}
            value={totalMessages}
            description={t("dashboard.stats.totalMessagesSent")}
            icon={MessageSquare}
            iconColor="text-blue-600"
            iconBgColor="bg-blue-500/10"
            isLoading={messagesLoading}
          />

          <StatCard
            title={t("dashboard.stats.totalFiles")}
            value={filesData?.count || 0}
            description={t("dashboard.stats.uploadedFiles")}
            icon={FileText}
            iconColor="text-green-600"
            iconBgColor="bg-green-500/10"
          />
        </div>

        {/* Messages Graph */}
        <MessagesChart
          data={messageData}
          isLoading={messagesLoading}
          dateOffset={dateOffset}
          onPreviousPeriod={handlePreviousPeriod}
          onNextPeriod={handleNextPeriod}
        />
      </div>
    </div>
  );
}
