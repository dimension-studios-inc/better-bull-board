"use client";

import { Line, LineChart, ResponsiveContainer } from "recharts";

interface QueueChartData {
  timestamp: string;
  completed: number;
  failed: number;
}

interface QueueMiniChartProps {
  data: QueueChartData[];
}

export function QueueMiniChart({ data }: QueueMiniChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="h-16 w-32 flex items-center justify-center text-xs text-muted-foreground">
        No data
      </div>
    );
  }

  // Process data to ensure we have valid timestamps
  const processedData = data.map((item) => ({
    ...item,
    timestamp: new Date(item.timestamp).toISOString(),
  }));

  return (
    <div className="h-8 w-16">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={processedData}>
          <Line
            type="monotone"
            dataKey="completed"
            stroke="#10b981"
            strokeWidth={1.5}
            dot={false}
            activeDot={false}
          />
          <Line
            type="monotone"
            dataKey="failed"
            stroke="#ef4444"
            strokeWidth={1.5}
            dot={false}
            activeDot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
