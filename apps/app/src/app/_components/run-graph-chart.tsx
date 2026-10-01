"use client"

import { format } from "date-fns"
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import type { z } from "zod"
import type { dashboardRunGraphOutput } from "~/app/api/dashboard/summary/schemas"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { Skeleton } from "~/components/ui/skeleton"

interface RunGraphChartProps {
  days: number
  runGraphData: z.output<typeof dashboardRunGraphOutput>[] | undefined
  isLoading: boolean
}

const CustomTooltip =
  ({ days }: { days: number }) =>
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
        <div className="bg-background border rounded-lg px-2.5 py-1.5 text-xs shadow-xl">
          <p className="font-medium">
            {data.timestamp && format(new Date(data.timestamp), days <= 7 ? "EEEEEE HH:mm" : "MMM dd, yyyy")}
          </p>
          <p className="text-muted-foreground">
            Runs: <span className="font-mono font-medium text-foreground">{data.runCount.toLocaleString()}</span>
          </p>
        </div>
      )
    }
    return null
  }

export function RunGraphChart({ days, runGraphData, isLoading }: RunGraphChartProps) {
  const chartData =
    runGraphData?.map((item) => ({
      timestamp: item.timestamp,
      runCount: item.runCount,
      formattedTime: format(new Date(item.timestamp), days <= 7 ? "EEEEEE HH:mm" : "MMM dd"),
    })) || []

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Total Runs</CardTitle>
        <CardDescription>
          Runs over the last {days} day{days > 1 ? "s" : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        {isLoading ? (
          <div className="h-64 sm:h-80 flex items-center justify-center">
            <Skeleton className="h-full w-full" />
          </div>
        ) : chartData.length > 0 ? (
          <div className="h-64 sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ left: 0, right: 12 }}>
                <defs>
                  <linearGradient id="fillRunCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0.1} />
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
                <Tooltip content={CustomTooltip({ days })} cursor={{ stroke: "var(--border)" }} />
                <Area
                  type="natural"
                  dataKey="runCount"
                  fill="url(#fillRunCount)"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  name="Run Count"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-64 sm:h-80 flex items-center justify-center">
            <p className="text-muted-foreground">No data available</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
