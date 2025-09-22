"use client";

import { useQuery } from "@tanstack/react-query";
import { analytics } from "@/lib/api";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface AnalyticsChartProps {
  chatbotId: string;
}

export function AnalyticsChart({ chatbotId }: AnalyticsChartProps) {
  // Fetch message volume
  const { data: messageVolume } = useQuery({
    queryKey: ["messageVolume", chatbotId],
    queryFn: async () => {
      const response = await analytics.getMessageVolume(chatbotId);
      return response.data;
    },
  });

  // Fetch popular topics
  const { data: topics } = useQuery({
    queryKey: ["topics", chatbotId],
    queryFn: async () => {
      const response = await analytics.getTopics(chatbotId);
      return response.data;
    },
  });

  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8"];

  return (
    <div className="space-y-8">
      {/* Message Volume Chart */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Message Volume Over Time
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={messageVolume || []}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="period" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="userMessages"
              stroke="#8884d8"
              name="User Messages"
            />
            <Line
              type="monotone"
              dataKey="assistantMessages"
              stroke="#82ca9d"
              name="Assistant Messages"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Popular Topics */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Popular Topics
        </h3>
        {topics?.topics && topics.topics.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topics.topics.slice(0, 10)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="word" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-gray-500 text-center py-8">
            No topic data available yet
          </p>
        )}
      </div>

      {/* Usage Distribution */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Usage Patterns
        </h3>
        <div className="grid grid-cols-2 gap-8">
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">
              Message Types
            </h4>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={[
                    {
                      name: "User",
                      value:
                        messageVolume?.reduce(
                          (acc: number, v: any) => acc + v.userMessages,
                          0,
                        ) || 0,
                    },
                    {
                      name: "Assistant",
                      value:
                        messageVolume?.reduce(
                          (acc: number, v: any) => acc + v.assistantMessages,
                          0,
                        ) || 0,
                    },
                  ]}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                >
                  {[0, 1].map((index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center justify-center">
            <div className="text-center">
              <p className="text-3xl font-bold text-gray-900">
                {topics?.totalMessages || 0}
              </p>
              <p className="text-sm text-gray-600">Total Messages Analyzed</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
