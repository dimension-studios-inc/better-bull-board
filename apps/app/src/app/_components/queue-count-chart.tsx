"use client"

import type { z } from "zod"

import type { dashboardTopQueuesCountOutput } from "~/app/api/dashboard/summary/schemas"

import { QueueBarChart } from "./queue-bar-chart"

interface QueueCountChartProps {
  minutes: number
  queueCounts: z.output<typeof dashboardTopQueuesCountOutput>[] | undefined
  isLoading: boolean
}

const formatCount = (value: number) => value.toLocaleString()

export function QueueCountChart({ minutes, queueCounts, isLoading }: QueueCountChartProps) {
  return (
    <QueueBarChart
      title="Most-Ran Queues"
      minutes={minutes}
      data={queueCounts?.map((item) => ({ queue: item.queue, value: item.runCount }))}
      isLoading={isLoading}
      color="var(--chart-2)"
      valueLabel="Runs"
      formatValue={formatCount}
    />
  )
}
