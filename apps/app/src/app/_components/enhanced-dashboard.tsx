"use client"

import { useQuery } from "@tanstack/react-query"
import { getDashboardSummaryApiRoute } from "~/app/api/dashboard/summary/schemas"
import {
  DEFAULT_TIME_PERIOD,
  getTimePeriodLabel,
  TimePeriodSelector,
  useStoredTimePeriod,
} from "~/components/time-period-selector"
import { apiFetch } from "~/lib/utils/client"
import { EnhancedStatsCards } from "./enhanced-stats-cards"
import { QueueCountChart } from "./queue-count-chart"
import { QueueDurationChart } from "./queue-duration-chart"
import { QueuePerformanceTable } from "./queue-performance-table"
import { RunGraphChart } from "./run-graph-chart"

export function EnhancedDashboard() {
  const [storedMinutes, setMinutes] = useStoredTimePeriod()
  const minutes = storedMinutes ?? DEFAULT_TIME_PERIOD
  const periodLabel = getTimePeriodLabel(minutes)
  // Pending, not loading: the query waits for the stored period to be read
  const { data: dashboardSummary, isPending: isLoading } = useQuery({
    queryKey: ["dashboard/summary", minutes],
    queryFn: apiFetch({
      apiRoute: getDashboardSummaryApiRoute,
      body: { minutes },
    }),
    enabled: storedMinutes !== null,
    // Short periods move fast: keep them live
    refetchInterval: minutes <= 60 ? 15 * 1000 : false,
  })

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      {/* Time Period Selector */}
      <div className="flex items-center">
        <TimePeriodSelector value={minutes} onChange={setMinutes} />
      </div>

      {/* Enhanced Stats Cards */}
      <EnhancedStatsCards
        // The links hold the time they are rendered at: none while hydrating, or they would not match the server
        minutes={storedMinutes}
        periodLabel={periodLabel}
        stats={dashboardSummary?.enhancedStats}
        isLoading={isLoading}
      />

      {/* Queue Performance Table */}
      <QueuePerformanceTable
        minutes={minutes}
        queuePerformance={dashboardSummary?.queuePerformance}
        isLoading={isLoading}
      />

      {/* Charts Grid */}
      <div className="grid grid-cols-1 gap-4 md:gap-6 @4xl/main:grid-cols-2">
        <QueueDurationChart queueDuration={dashboardSummary?.topQueuesDuration.slice(0, 10)} isLoading={isLoading} />
        <QueueCountChart queueCounts={dashboardSummary?.topQueuesCount.slice(0, 10)} isLoading={isLoading} />
      </div>

      {/* Run Graph */}
      <RunGraphChart
        minutes={minutes}
        periodLabel={periodLabel}
        runGraphData={dashboardSummary?.runGraph}
        isLoading={isLoading}
      />
    </div>
  )
}
