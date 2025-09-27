"use client";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getRunGraphApiRoute } from "~/app/api/dashboard/run-graph/schemas";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { apiFetch } from "~/lib/utils/client";

interface RunGraphChartProps {
  days: number;
}

export function RunGraphChart({ days }: RunGraphChartProps) {
  const { data: runGraphData, isLoading } = useQuery({
    queryKey: ["dashboard/run-graph", days],
    queryFn: apiFetch({
      apiRoute: getRunGraphApiRoute,
      body: { days },
    }),
  });

  const chartData = runGraphData?.map((item) => ({
    timestamp: item.timestamp,
    runCount: item.runCount,
    formattedTime: format(new Date(item.timestamp), days <= 1 ? "HH:mm" : "MMM dd"),
  })) || [];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background border rounded-lg p-3 shadow-lg">
          <p className="font-medium">
            {format(new Date(label), days <= 1 ? "HH:mm" : "MMM dd, yyyy")}
          </p>
          <p className="text-sm text-blue-600">
            Runs: {data.runCount.toLocaleString()}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Run Graph</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-80 flex items-center justify-center">
            <Skeleton className="h-80 w-full" />
          </div>
        ) : chartData.length > 0 ? (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="formattedTime"
                  tick={{ fontSize: 12 }}
                  interval="preserveStartEnd"
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="runCount"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                  name="Run Count"
                />
              </LineChart>
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