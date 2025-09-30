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
import { getTopQueuesDurationApiRoute } from "~/app/api/dashboard/top-queues-duration/schemas";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { apiFetch } from "~/lib/utils/client";

interface QueueDurationChartProps {
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
        <p className="text-muted-foreground">{data.formattedValue}</p>
      </div>
    );
  }
  return null;
};

export function QueueDurationChart({ days }: QueueDurationChartProps) {
  const { data: queueDuration, isLoading } = useQuery({
    queryKey: ["dashboard/top-queues-duration", days],
    queryFn: apiFetch({
      apiRoute: getTopQueuesDurationApiRoute,
      body: { days, limit: 10 },
    }),
  });

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    if (seconds < 3600) return `${(seconds / 60).toFixed(1)}m`;
    return `${(seconds / 3600).toFixed(1)}h`;
  };

  const chartData =
    queueDuration?.map((item) => ({
      queue: item.queue,
      value: item.totalDuration,
      formattedValue: formatDuration(item.totalDuration),
    })) || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Average Duration by Queues</CardTitle>
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
                  tickFormatter={(value) => formatDuration(value)}
                />
                <Tooltip content={CustomTooltip} />
                <Bar
                  dataKey="value"
                  fill="#3b82f6"
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
