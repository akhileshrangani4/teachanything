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
import type { RouterOutputs } from "@/lib/trpc";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { chartColors } from "./constants";
import { ChartSkeleton, EmptyChart } from "./metric-card";

type DistributionData =
  RouterOutputs["analytics"]["getSessionLengthDistribution"];

export function MessagesOverTimeCard({
  isLoading,
  data,
}: {
  isLoading: boolean;
  data: Array<{ date: string; messages: number }>;
}) {
  return (
    <Card className="border border-border/60 shadow-xs">
      <CardHeader>
        <CardTitle>Messages Over Time</CardTitle>
        <CardDescription>Student messages by day</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <ChartSkeleton />
        ) : data.length === 0 ? (
          <EmptyChart label="No message data yet" />
        ) : (
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={data}
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
  );
}

export function SessionsOverTimeCard({
  isLoading,
  data,
}: {
  isLoading: boolean;
  data: Array<{ date: string; sessions: number }>;
}) {
  return (
    <Card className="border border-border/60 shadow-xs">
      <CardHeader>
        <CardTitle>Sessions Over Time</CardTitle>
        <CardDescription>Unique active sessions by day</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <ChartSkeleton />
        ) : data.every((item) => item.sessions === 0) ? (
          <EmptyChart label="No session data yet" />
        ) : (
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={data}
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
  );
}

export function SessionLengthsCard({
  isLoading,
  data,
}: {
  isLoading: boolean;
  data: DistributionData;
}) {
  return (
    <Card className="border border-border/60 shadow-xs xl:col-span-2">
      <CardHeader>
        <CardTitle>Session Lengths</CardTitle>
        <CardDescription>Sessions grouped by message count</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <ChartSkeleton />
        ) : data.every((item) => item.count === 0) ? (
          <EmptyChart label="No session lengths yet" />
        ) : (
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
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
  );
}
