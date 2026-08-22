"use client";

import { useState } from "react";
import { keepPreviousData } from "@tanstack/react-query";
import {
  AlertCircle,
  Clock,
  Database,
  MessageSquare,
  Users,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { MetricCard } from "./analytics-tab/metric-card";
import {
  MessagesOverTimeCard,
  SessionLengthsCard,
  SessionsOverTimeCard,
} from "./analytics-tab/charts";
import { CommonQuestionsCard } from "./analytics-tab/common-questions-card";
import { LowConfidenceCard } from "./analytics-tab/low-confidence-card";
import {
  formatChartDate,
  formatDurationSeconds,
} from "./analytics-tab/formatters";
import { COMMON_QUESTIONS_PAGE_SIZE } from "./analytics-tab/constants";

interface ChatbotAnalyticsTabProps {
  chatbotId: string;
}

export function ChatbotAnalyticsTab({ chatbotId }: ChatbotAnalyticsTabProps) {
  const statsQuery = trpc.analytics.getChatbotStats.useQuery(
    { chatbotId },
    { enabled: !!chatbotId },
  );
  const sessionMetricsQuery = trpc.analytics.getSessionMetrics.useQuery(
    { chatbotId },
    { enabled: !!chatbotId },
  );
  const messageVolumeQuery = trpc.analytics.getMessageVolume.useQuery(
    { chatbotId, timeRange: "month" },
    { enabled: !!chatbotId },
  );
  const sessionsOverTimeQuery = trpc.analytics.getSessionsOverTime.useQuery(
    { chatbotId, timeRange: "month", interval: "day" },
    { enabled: !!chatbotId },
  );
  const distributionQuery =
    trpc.analytics.getSessionLengthDistribution.useQuery(
      { chatbotId },
      { enabled: !!chatbotId },
    );
  const [questionsOffset, setQuestionsOffset] = useState(0);
  const commonQuestionsQuery = trpc.analytics.getCommonQuestions.useQuery(
    {
      chatbotId,
      limit: COMMON_QUESTIONS_PAGE_SIZE,
      offset: questionsOffset,
    },
    { enabled: !!chatbotId, placeholderData: keepPreviousData },
  );
  const lowConfidenceQuery = trpc.analytics.getLowConfidenceQueries.useQuery(
    { chatbotId, limit: 5, offset: 0 },
    { enabled: !!chatbotId },
  );

  const sessionMetrics = sessionMetricsQuery.data;
  const stats = statsQuery.data;
  const summaryLoading = statsQuery.isLoading || sessionMetricsQuery.isLoading;
  const messagesChartData =
    messageVolumeQuery.data?.map((item) => ({
      date: formatChartDate(item.date),
      messages: item.count,
    })) ?? [];
  const sessionsChartData =
    sessionsOverTimeQuery.data?.map((item) => ({
      date: formatChartDate(item.date),
      sessions: item.count,
    })) ?? [];
  const distributionData = distributionQuery.data ?? [];
  const hasError =
    statsQuery.isError ||
    sessionMetricsQuery.isError ||
    messageVolumeQuery.isError ||
    sessionsOverTimeQuery.isError ||
    distributionQuery.isError ||
    commonQuestionsQuery.isError ||
    lowConfidenceQuery.isError;

  if (hasError) {
    return (
      <Card className="border border-destructive/30 shadow-xs">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle className="h-10 w-10 text-destructive mb-3" />
          <p className="text-lg font-medium text-destructive">
            Analytics failed to load
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Please refresh and try again.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard
          title="Unique Sessions"
          value={sessionMetrics?.totalUniqueSessions ?? 0}
          description="Student chat sessions"
          icon={Users}
          isLoading={summaryLoading}
        />
        <MetricCard
          title="Avg Msgs/Session"
          value={sessionMetrics?.avgMessagesPerSession ?? 0}
          description="Student messages per session"
          icon={MessageSquare}
          isLoading={summaryLoading}
        />
        <MetricCard
          title="Avg Duration"
          value={formatDurationSeconds(
            sessionMetrics?.avgSessionDurationSeconds ?? 0,
          )}
          description="First to last message"
          icon={Clock}
          isLoading={summaryLoading}
        />
        <MetricCard
          title="RAG Hit Rate"
          value={`${stats?.ragUsagePercentage ?? 0}%`}
          description="Messages using source context"
          icon={Database}
          isLoading={summaryLoading}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <MessagesOverTimeCard
          isLoading={messageVolumeQuery.isLoading}
          data={messagesChartData}
        />

        <SessionsOverTimeCard
          isLoading={sessionsOverTimeQuery.isLoading}
          data={sessionsChartData}
        />

        <SessionLengthsCard
          isLoading={distributionQuery.isLoading}
          data={distributionData}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <CommonQuestionsCard
          isLoading={commonQuestionsQuery.isLoading}
          data={commonQuestionsQuery.data}
          offset={questionsOffset}
          onOffsetChange={setQuestionsOffset}
        />

        <LowConfidenceCard
          isLoading={lowConfidenceQuery.isLoading}
          data={lowConfidenceQuery.data}
        />
      </div>
    </div>
  );
}
