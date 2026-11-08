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
import { useTranslation } from "react-i18next";

type DistributionData =
  RouterOutputs["analytics"]["getSessionLengthDistribution"];

export function MessagesOverTimeCard({
  isLoading,
  data,
}: {
  isLoading: boolean;
  data: Array<{ date: string; messages: number }>;
}) {
  const { t } = useTranslation();
  return (
    <Card className="border border-border/60 shadow-xs">
      <CardHeader>
        <CardTitle>{t("analytics.charts.messagesTitle")}</CardTitle>
        <CardDescription>
          {t("analytics.charts.messagesDescription")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <ChartSkeleton />
        ) : data.length === 0 ? (
          <EmptyChart label={t("analytics.charts.messagesEmpty")} />
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
                  name={t("analytics.charts.seriesMessages")}
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
  const { t } = useTranslation();
  return (
    <Card className="border border-border/60 shadow-xs">
      <CardHeader>
        <CardTitle>{t("analytics.charts.sessionsTitle")}</CardTitle>
        <CardDescription>
          {t("analytics.charts.sessionsDescription")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <ChartSkeleton />
        ) : data.every((item) => item.sessions === 0) ? (
          <EmptyChart label={t("analytics.charts.sessionsEmpty")} />
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
                  name={t("analytics.charts.seriesSessions")}
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
  const { t } = useTranslation();
  return (
    <Card className="border border-border/60 shadow-xs xl:col-span-2">
      <CardHeader>
        <CardTitle>{t("analytics.charts.lengthsTitle")}</CardTitle>
        <CardDescription>
          {t("analytics.charts.lengthsDescription")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <ChartSkeleton />
        ) : data.every((item) => item.count === 0) ? (
          <EmptyChart label={t("analytics.charts.lengthsEmpty")} />
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
                  name={t("analytics.charts.seriesSessions")}
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
