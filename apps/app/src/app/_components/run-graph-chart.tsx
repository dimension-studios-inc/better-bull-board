"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@better-bull-board/ui/components/card"
import { Skeleton } from "@better-bull-board/ui/components/skeleton"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import type { z } from "zod"

import type { dashboardRunGraphOutput } from "~/app/api/dashboard/summary/schemas"
import { formatUtc } from "~/lib/utils/date"

import { CHART_RESIZE_DEBOUNCE_MS } from "./chart-config"

interface RunGraphChartProps {
  minutes: number
  periodLabel: string
  runGraphData: z.output<typeof dashboardRunGraphOutput>[] | undefined
  isLoading: boolean
}

// Graph buckets go from 10 seconds (last 5 minutes) to 1 day (last 30 days)
export const getTimeFormats = (minutes: number) => {
  if (minutes <= 15) return { axis: "HH:mm:ss", tooltip: "HH:mm:ss" }
  if (minutes <= 12 * 60) return { axis: "HH:mm", tooltip: "HH:mm" }
  if (minutes <= 7 * 24 * 60) return { axis: "EEEEEE HH:mm", tooltip: "EEEEEE HH:mm" }
  return { axis: "MMM dd", tooltip: "MMM dd, yyyy" }
}

const CustomTooltip =
  ({ tooltipFormat }: { tooltipFormat: string }) =>
  ({
    active,
    payload,
  }: {
    active: boolean
    // biome-ignore lint/suspicious/noExplicitAny: _
    payload: any
    label?: string | number
  }) => {
    if (active && payload?.length) {
      const data = payload[0].payload
      return (
        <div className="rounded-lg border bg-background px-2.5 py-1.5 text-xs shadow-xl">
          <p className="font-medium">
            {data.timestamp && `${formatUtc(data.timestamp, tooltipFormat)} UTC`}
          </p>
          <p className="text-muted-foreground">
            Runs:{" "}
            <span className="font-mono font-medium text-foreground">
              {data.runCount.toLocaleString()}
            </span>
          </p>
        </div>
      )
    }
    return null
  }

export function RunGraphChart({
  minutes,
  periodLabel,
  runGraphData,
  isLoading,
}: RunGraphChartProps) {
  const timeFormats = getTimeFormats(minutes)
  const chartData =
    runGraphData?.map((item) => ({
      timestamp: item.timestamp,
      runCount: item.runCount,
      formattedTime: formatUtc(item.timestamp, timeFormats.axis),
    })) || []

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Total Runs</CardTitle>
        <CardDescription>
          Runs created in the {periodLabel.toLowerCase()} (times in UTC)
        </CardDescription>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center sm:h-80">
            <Skeleton className="h-full w-full" />
          </div>
        ) : chartData.length > 0 ? (
          <div className="h-64 sm:h-80">
            <ResponsiveContainer width="100%" height="100%" debounce={CHART_RESIZE_DEBOUNCE_MS}>
              <AreaChart data={chartData} margin={{ left: 0, right: 12 }}>
                <defs>
                  <linearGradient id="fillRunCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--chart-3)" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="var(--chart-3)" stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="formattedTime"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={32}
                  tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={48}
                  tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                  tickFormatter={(value) => value.toLocaleString()}
                />
                <Tooltip
                  content={CustomTooltip({ tooltipFormat: timeFormats.tooltip })}
                  cursor={{ stroke: "var(--border)" }}
                />
                <Area
                  type="natural"
                  dataKey="runCount"
                  fill="url(#fillRunCount)"
                  stroke="var(--chart-3)"
                  strokeWidth={2}
                  name="Run Count"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex h-64 items-center justify-center sm:h-80">
            <p className="text-muted-foreground">No data available</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
