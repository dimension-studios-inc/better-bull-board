"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface JobTrendData {
  hourlyStats: Array<{
    hour: string;
    completed: number;
    failed: number;
    running: number;
  }>;
  queueActivity: Array<{
    name: string;
    jobs: number;
    rate: number;
  }>;
}

interface JobTrendChartProps {
  data: JobTrendData;
}

export function JobTrendChart({ data }: JobTrendChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data.hourlyStats}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="hour" />
        <YAxis />
        <Tooltip />
        <Line
          type="monotone"
          dataKey="completed"
          stroke="#10b981"
          strokeWidth={2}
          name="Completed"
        />
        <Line
          type="monotone"
          dataKey="failed"
          stroke="#ef4444"
          strokeWidth={2}
          name="Failed"
        />
        <Line
          type="monotone"
          dataKey="running"
          stroke="#3b82f6"
          strokeWidth={2}
          name="Running"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
