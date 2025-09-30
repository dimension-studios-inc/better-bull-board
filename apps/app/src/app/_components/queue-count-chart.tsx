"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getTopQueuesCountApiRoute } from "~/app/api/dashboard/top-queues-count/schemas";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { apiFetch } from "~/lib/utils/client";

interface QueueCountChartProps {
  days: number;
}

const CustomTooltip = ({
  active,
  payload,
}: {
  active: boolean;
  // biome-ignore lint/suspicious/noExplicitAny: _
  payload: any;
}) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-background border rounded p-3 shadow-lg text-sm">
        <p className="font-medium">{data.queue}</p>
        <p className="text-muted-foreground">
          Runs: {data.value.toLocaleString()}
        </p>
      </div>
    );
  }
  return null;
};

export function QueueCountChart({ days }: QueueCountChartProps) {
  const { data: queueCounts, isLoading } = useQuery({
    queryKey: ["dashboard/top-queues-count", days],
    queryFn: apiFetch({
      apiRoute: getTopQueuesCountApiRoute,
      body: { days, limit: 10 },
    }),
  });

  const chartData =
    queueCounts?.map((item) => ({
      queue: item.queue,
      value: item.runCount,
    })) || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Most-Ran Queues</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-80 flex items-center justify-center">
            <Skeleton className="h-80 w-full" />
          </div>
        ) : chartData.length > 0 ? (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
              >
                <XAxis
                  dataKey="queue"
                  tick={{ fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => value.toLocaleString()}
                />
                <Tooltip content={CustomTooltip} />
                <Bar
                  dataKey="value"
                  fill="#10b981"
                  radius={[4, 4, 0, 0]}
                  className="hover:opacity-80 transition-opacity"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-80 flex items-center justify-center">
            <p className="text-muted-foreground">No data available</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
