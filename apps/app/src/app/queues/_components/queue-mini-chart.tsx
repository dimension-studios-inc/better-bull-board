"use client";

import { format } from "date-fns";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface QueueChartData {
  timestamp: string;
  completed: number;
  failed: number;
}

interface QueueMiniChartProps {
  data: QueueChartData[];
  timePeriod: string;
}

export function QueueMiniChart({ data, timePeriod }: QueueMiniChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="h-16 w-32 flex items-center justify-center text-xs text-muted-foreground">
        No data
      </div>
    );
  }

  // Determine the date format based on time period
  const getDateFormat = (timePeriod: string): string => {
    const period = parseInt(timePeriod);
    if (period <= 1) {
      return "HH:mm"; // Hours for 1 day
    } else if (period <= 7) {
      return "MM/dd HH:mm"; // Days and hours for up to 7 days
    } else {
      return "MM/dd"; // Just days for longer periods
    }
  };

  const formatTooltipLabel = (value: string): string => {
    const date = new Date(value);
    const period = parseInt(timePeriod);
    
    if (period <= 1) {
      return format(date, "MMM dd, HH:mm");
    } else if (period <= 7) {
      return format(date, "MMM dd, HH:mm");
    } else {
      return format(date, "MMM dd, yyyy");
    }
  };

  const formatXAxisLabel = (value: string): string => {
    const date = new Date(value);
    return format(date, getDateFormat(timePeriod));
  };

  // Process data to ensure we have valid timestamps
  const processedData = data.map((item) => ({
    ...item,
    timestamp: new Date(item.timestamp).toISOString(),
  }));

  return (
    <div className="h-16 w-32">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={processedData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          <XAxis 
            dataKey="timestamp" 
            axisLine={false}
            tickLine={false}
            tick={false}
          />
          <YAxis 
            axisLine={false}
            tickLine={false}
            tick={false}
          />
          <Tooltip 
            labelFormatter={formatTooltipLabel}
            contentStyle={{
              backgroundColor: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "6px",
              fontSize: "12px",
            }}
            formatter={(value: number, name: string) => [
              value,
              name === "completed" ? "Completed" : "Failed"
            ]}
          />
          <Line
            type="monotone"
            dataKey="completed"
            stroke="#10b981"
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 2, stroke: "#10b981", strokeWidth: 1 }}
          />
          <Line
            type="monotone"
            dataKey="failed"
            stroke="#ef4444"
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 2, stroke: "#ef4444", strokeWidth: 1 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}