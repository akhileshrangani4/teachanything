"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  Clock,
  Database,
  HelpCircle,
  MessageSquare,
  Users,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";

interface ChatbotAnalyticsTabProps {
  chatbotId: string;
}

const chartColors = {
  grid: "var(--muted)",
  tick: "var(--muted-foreground)",
  card: "var(--card)",
  border: "var(--border)",
  primary: "var(--primary)",
  sessions: "#0f766e",
} as const;

function formatDurationSeconds(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0
      ? `${minutes}m ${remainingSeconds}s`
      : `${minutes}m`;
  }
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}

function formatChartDate(date: string): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function MetricCard({
  title,
  value,
  description,
  icon: Icon,
  isLoading,
}: {
  title: string;
  value: string | number;
  description: string;
  icon: LucideIcon;
  isLoading: boolean;
}) {
  return (
    <Card className="border border-border/60 shadow-xs">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase">
          {title}
        </CardTitle>
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="h-5 w-5 text-primary" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">
          {isLoading ? <Skeleton className="h-9 w-20 rounded" /> : value}
        </div>
        <p className="text-xs text-muted-foreground mt-2">{description}</p>
      </CardContent>
    </Card>
  );
}

function ChartSkeleton() {
  return (
    <div className="h-[280px] flex items-end gap-3 px-4 pb-6 pt-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton
          key={i}
          className="flex-1 rounded"
          style={{ height: `${35 + ((i * 17) % 50)}%` }}
        />
      ))}
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="h-[280px] flex items-center justify-center border border-dashed border-muted rounded-lg">
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
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
  const commonQuestionsQuery = trpc.analytics.getCommonQuestions.useQuery(
    { chatbotId, limit: 10, offset: 0 },
    { enabled: !!chatbotId },
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
        <Card className="border border-border/60 shadow-xs">
          <CardHeader>
            <CardTitle>Messages Over Time</CardTitle>
            <CardDescription>Student messages by day</CardDescription>
          </CardHeader>
          <CardContent>
            {messageVolumeQuery.isLoading ? (
              <ChartSkeleton />
            ) : messagesChartData.length === 0 ? (
              <EmptyChart label="No message data yet" />
            ) : (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={messagesChartData}
                    margin={{ top: 5, right: 16, left: -10, bottom: 5 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={chartColors.grid}
                      opacity={0.3}
                      vertical={false}
                    />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: chartColors.tick }}
                      tickLine={false}
                      axisLine={false}
                      dy={8}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: chartColors.tick }}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: chartColors.card,
                        border: `1px solid ${chartColors.border}`,
                        borderRadius: "8px",
                        fontSize: "13px",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="messages"
                      stroke={chartColors.primary}
                      strokeWidth={2.5}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border border-border/60 shadow-xs">
          <CardHeader>
            <CardTitle>Sessions Over Time</CardTitle>
            <CardDescription>Unique active sessions by day</CardDescription>
          </CardHeader>
          <CardContent>
            {sessionsOverTimeQuery.isLoading ? (
              <ChartSkeleton />
            ) : sessionsChartData.every((item) => item.sessions === 0) ? (
              <EmptyChart label="No session data yet" />
            ) : (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={sessionsChartData}
                    margin={{ top: 5, right: 16, left: -10, bottom: 5 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={chartColors.grid}
                      opacity={0.3}
                      vertical={false}
                    />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: chartColors.tick }}
                      tickLine={false}
                      axisLine={false}
                      dy={8}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: chartColors.tick }}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: chartColors.card,
                        border: `1px solid ${chartColors.border}`,
                        borderRadius: "8px",
                        fontSize: "13px",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="sessions"
                      stroke={chartColors.sessions}
                      strokeWidth={2.5}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border border-border/60 shadow-xs">
          <CardHeader>
            <CardTitle>Session Lengths</CardTitle>
            <CardDescription>Sessions grouped by message count</CardDescription>
          </CardHeader>
          <CardContent>
            {distributionQuery.isLoading ? (
              <ChartSkeleton />
            ) : distributionData.every((item) => item.count === 0) ? (
              <EmptyChart label="No session lengths yet" />
            ) : (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={distributionData}
                    margin={{ top: 5, right: 16, left: -10, bottom: 5 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={chartColors.grid}
                      opacity={0.3}
                      vertical={false}
                    />
                    <XAxis
                      dataKey="bucket"
                      tick={{ fontSize: 11, fill: chartColors.tick }}
                      tickLine={false}
                      axisLine={false}
                      dy={8}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: chartColors.tick }}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: chartColors.card,
                        border: `1px solid ${chartColors.border}`,
                        borderRadius: "8px",
                        fontSize: "13px",
                      }}
                    />
                    <Bar
                      dataKey="count"
                      fill={chartColors.primary}
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card className="border border-border/60 shadow-xs">
          <CardHeader>
            <CardTitle>Common Questions</CardTitle>
            <CardDescription>
              Top first messages across student sessions
            </CardDescription>
          </CardHeader>
          <CardContent>
            {commonQuestionsQuery.isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded" />
                ))}
              </div>
            ) : !commonQuestionsQuery.data ||
              commonQuestionsQuery.data.questions.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                No common questions yet
              </div>
            ) : (
              <div className="space-y-3">
                {commonQuestionsQuery.data.questions.map((question, index) => (
                  <div
                    key={`${question.question}-${index}`}
                    className="flex items-start gap-3 rounded-lg border p-3"
                  >
                    <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold shrink-0">
                      {question.count}
                    </div>
                    <p className="text-sm leading-6 break-words">
                      {question.question}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border border-border/60 shadow-xs">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5" />
              Low-Confidence Queries
            </CardTitle>
            <CardDescription>
              Messages that did not use RAG context
            </CardDescription>
          </CardHeader>
          <CardContent>
            {lowConfidenceQuery.isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded" />
                ))}
              </div>
            ) : !lowConfidenceQuery.data ||
              lowConfidenceQuery.data.queries.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                No low-confidence queries found
              </div>
            ) : (
              <div className="space-y-3">
                {lowConfidenceQuery.data.queries.map((query) => (
                  <div key={query.id} className="rounded-lg border p-3">
                    <p className="text-sm leading-6 break-words">
                      {query.question}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span>
                        {new Date(query.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                      {query.sessionId && (
                        <span>Session {query.sessionId.slice(0, 8)}...</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
