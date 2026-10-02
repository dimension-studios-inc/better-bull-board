"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@better-bull-board/ui/components/card"
import { Skeleton } from "@better-bull-board/ui/components/skeleton"
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import type { z } from "zod"
import type { dashboardTopQueuesCountOutput } from "~/app/api/dashboard/summary/schemas"

interface QueueCountChartProps {
  queueCounts: z.output<typeof dashboardTopQueuesCountOutput>[] | undefined
  isLoading: boolean
}

const CustomTooltip = ({
  active,
  payload,
}: {
  active: boolean
  // biome-ignore lint/suspicious/noExplicitAny: _
  payload: any
}) => {
  if (active && payload?.length) {
    const data = payload[0].payload
    return (
      <div className="bg-background border rounded p-3 shadow-lg text-sm">
        <p className="font-medium">{data.queue}</p>
        <p className="text-muted-foreground">Runs: {data.value.toLocaleString()}</p>
      </div>
    )
  }
  return null
}

export function QueueCountChart({ queueCounts, isLoading }: QueueCountChartProps) {
  const chartData =
    queueCounts?.map((item) => ({
      queue: item.queue,
      value: item.runCount,
    })) || []

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
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <XAxis dataKey="queue" tick={{ fontSize: 12 }} angle={-45} textAnchor="end" height={80} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(value) => value.toLocaleString()} />
                <Tooltip content={CustomTooltip} />
                <Bar
                  dataKey="value"
                  fill="var(--chart-2)"
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
  )
}
