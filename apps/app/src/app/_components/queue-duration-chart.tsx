"use client";

import { useQuery } from "@tanstack/react-query";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { getTopQueuesDurationApiRoute } from "~/app/api/dashboard/top-queues-duration/schemas";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { apiFetch } from "~/lib/utils/client";
import { COLORS } from "./colors";

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
      <div className="bg-background border rounded p-2 shadow-sm text-sm">
        <p className="font-medium">{data.name}</p>
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
      name: item.queue,
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
            <Skeleton className="h-80 w-80 rounded-full" />
          </div>
        ) : chartData.length > 0 ? (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }) =>
                    `${name} (${((percent as number) * 100).toFixed(0)}%)`
                  }
                  labelLine={false}
                >
                  {chartData.map((_, index) => (
                    <Cell
                      // biome-ignore lint/suspicious/noArrayIndexKey: _
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip content={CustomTooltip} />
              </PieChart>
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
