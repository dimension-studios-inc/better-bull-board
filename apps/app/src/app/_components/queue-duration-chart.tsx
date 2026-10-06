"use client"

import type { z } from "zod"
import type { dashboardTopQueuesDurationOutput } from "~/app/api/dashboard/summary/schemas"
import { QueueBarChart } from "./queue-bar-chart"

interface QueueDurationChartProps {
  minutes: number
  queueDuration: z.output<typeof dashboardTopQueuesDurationOutput>[] | undefined
  isLoading: boolean
}

const formatDuration = (seconds: number) => {
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)}m`
  return `${(seconds / 3600).toFixed(1)}h`
}

export function QueueDurationChart({ minutes, queueDuration, isLoading }: QueueDurationChartProps) {
  return (
    <QueueBarChart
      title="Average Duration by Queue"
      minutes={minutes}
      data={queueDuration?.map((item) => ({ queue: item.queue, value: item.avgDuration }))}
      isLoading={isLoading}
      color="var(--chart-4)"
      valueLabel="Avg duration"
      formatValue={formatDuration}
    />
  )
}
