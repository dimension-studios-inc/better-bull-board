"use client";

import { useQuery } from "@tanstack/react-query";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { getTopQueuesCountApiRoute } from "~/app/api/dashboard/top-queues-count/schemas";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { apiFetch } from "~/lib/utils/client";
import { COLORS } from "./colors";

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
      <div className="bg-background border rounded p-2 shadow-sm text-sm">
        <p className="font-medium">{data.name}</p>
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
      name: item.queue,
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
