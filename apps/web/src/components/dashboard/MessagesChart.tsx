"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { MessageSquare, ChevronLeft, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { RouterOutputs } from "@/lib/trpc";

type MessageData = RouterOutputs["analytics"]["getTotalMessagesPerMonth"];

interface MessagesChartProps {
  data: MessageData | undefined;
  isLoading: boolean;
  dateOffset: number;
  onPreviousPeriod: () => void;
  onNextPeriod: () => void;
}

// Recharts requires CSS color strings (not Tailwind classes) for SVG attributes.
// Extract theme tokens so they're referenced in one place.
const chartColors = {
  grid: "hsl(var(--muted))",
  tick: "hsl(var(--muted-foreground))",
  card: "hsl(var(--card))",
  border: "hsl(var(--border))",
  primary: "hsl(var(--primary))",
} as const;

export function MessagesChart({
  data,
  isLoading,
  dateOffset,
  onPreviousPeriod,
  onNextPeriod,
}: MessagesChartProps) {
  // Format message data for chart
  const chartData =
    data?.data?.map((item) => ({
      date: new Date(item.date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      messages: item.count,
    })) || [];

  // Format date range for display
  const dateRange =
    data?.startDate && data?.endDate
      ? `${new Date(data.startDate).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })} - ${new Date(data.endDate).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}`
      : "";

  // Check if we've reached the account creation date limit
  const hasReachedAccountCreation =
    data?.accountCreatedAt &&
    data?.startDate &&
    new Date(data.startDate).getTime() <=
      new Date(data.accountCreatedAt).getTime();

  return (
    <Card className="border border-border/60 shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="text-lg sm:text-xl font-semibold">
              Messages Sent Over Time
            </CardTitle>
            <CardDescription className="text-base">
              {dateRange || "Track your chatbot usage over time"}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={onPreviousPeriod}
              disabled={isLoading || hasReachedAccountCreation}
              className="h-9 w-9"
              title={
                hasReachedAccountCreation
                  ? "Cannot go back further than account creation date"
                  : "Previous 30 days"
              }
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={onNextPeriod}
              disabled={isLoading || dateOffset === 0}
              className="h-9 w-9"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-[250px] sm:h-[350px] flex items-end gap-3 px-4 pb-6 pt-4">
            <Skeleton className="h-[40%] flex-1 rounded" />
            <Skeleton className="h-[65%] flex-1 rounded" />
            <Skeleton className="h-[45%] flex-1 rounded" />
            <Skeleton className="h-[80%] flex-1 rounded" />
            <Skeleton className="h-[55%] flex-1 rounded" />
            <Skeleton className="h-[70%] flex-1 rounded" />
            <Skeleton className="h-[35%] flex-1 rounded" />
            <Skeleton className="h-[60%] flex-1 rounded" />
            <Skeleton className="hidden sm:block h-[50%] flex-1 rounded" />
            <Skeleton className="hidden sm:block h-[75%] flex-1 rounded" />
            <Skeleton className="hidden sm:block h-[45%] flex-1 rounded" />
            <Skeleton className="hidden sm:block h-[85%] flex-1 rounded" />
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-[250px] sm:h-[350px] flex items-center justify-center border border-dashed border-muted rounded-lg">
            <div className="text-center">
              <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
              <p className="text-muted-foreground font-medium">
                No message data available yet
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Start chatting to see your analytics
              </p>
            </div>
          </div>
        ) : (
          <div className="h-[250px] sm:h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
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
                    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                    fontSize: "13px",
                    padding: "8px 12px",
                  }}
                  cursor={{ stroke: chartColors.border, strokeWidth: 1 }}
                />
                <Line
                  type="monotone"
                  dataKey="messages"
                  stroke={chartColors.primary}
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{
                    r: 5,
                    fill: chartColors.primary,
                    strokeWidth: 2,
                    stroke: chartColors.card,
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
