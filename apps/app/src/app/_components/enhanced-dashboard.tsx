"use client"

import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { getDashboardSummaryApiRoute } from "~/app/api/dashboard/summary/schemas"
import { type TimePeriod, TimePeriodSelector } from "~/components/time-period-selector"
import { apiFetch } from "~/lib/utils/client"
import { EnhancedStatsCards } from "./enhanced-stats-cards"
import { QueueCountChart } from "./queue-count-chart"
import { QueueDurationChart } from "./queue-duration-chart"
import { QueuePerformanceTable } from "./queue-performance-table"
import { RunGraphChart } from "./run-graph-chart"

export function EnhancedDashboard() {
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("1")
  const days = parseInt(timePeriod, 10)
  const { data: dashboardSummary, isLoading } = useQuery({
    queryKey: ["dashboard/summary", days],
    queryFn: apiFetch({
      apiRoute: getDashboardSummaryApiRoute,
      body: { days },
    }),
  })

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      {/* Time Period Selector */}
      <div className="flex items-center">
        <TimePeriodSelector value={timePeriod} onChange={setTimePeriod} />
      </div>

      {/* Enhanced Stats Cards */}
      <EnhancedStatsCards days={days} stats={dashboardSummary?.enhancedStats} isLoading={isLoading} />

      {/* Queue Performance Table */}
      <QueuePerformanceTable queuePerformance={dashboardSummary?.queuePerformance} isLoading={isLoading} />

      {/* Charts Grid */}
      <div className="grid grid-cols-1 gap-4 md:gap-6 @4xl/main:grid-cols-2">
        <QueueDurationChart queueDuration={dashboardSummary?.topQueuesDuration.slice(0, 10)} isLoading={isLoading} />
        <QueueCountChart queueCounts={dashboardSummary?.topQueuesCount.slice(0, 10)} isLoading={isLoading} />
      </div>

      {/* Run Graph */}
      <RunGraphChart days={days} runGraphData={dashboardSummary?.runGraph} isLoading={isLoading} />
    </div>
  )
}
