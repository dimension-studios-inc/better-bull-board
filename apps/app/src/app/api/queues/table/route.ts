import { listQueues } from "@better-bull-board/core/queues"
import { dashboardQueueHourlyStatsTable, jobRunsTable } from "@better-bull-board/db"
import { db } from "@better-bull-board/db/server"
import { and, gte, inArray, lt, sql } from "drizzle-orm"

import { startOfUtcDay, startOfUtcHour } from "~/lib/utils/date"
import { createAuthenticatedApiRoute } from "~/lib/utils/server"

import { getQueuesTableApiRoute } from "./schemas"

type ChartDataPoint = { timestamp: string; completed: number; failed: number }
type ChartStep = "hour" | "day"
// Bucket start as epoch milliseconds: timestamp columns hold UTC without time zone, which `new Date()` would read in
// the server's local time zone
type ChartDataRow = { queueName: string; timestamp: string; completed: number; failed: number }

const STEP_MS: Record<ChartStep, number> = { hour: 60 * 60 * 1000, day: 24 * 60 * 60 * 1000 }

function fillChartData(
  dateFrom: Date,
  dateTo: Date,
  stepKind: ChartStep,
  chartData: ChartDataPoint[],
) {
  const filled: ChartDataPoint[] = []
  const map = new Map(chartData.map((d) => [d.timestamp, d]))
  const start = stepKind === "hour" ? startOfUtcHour(dateFrom) : startOfUtcDay(dateFrom)

  for (let d = start.getTime(); d <= dateTo.getTime(); d += STEP_MS[stepKind]) {
    const ts = new Date(d).toISOString()

    const data = map.get(ts)
    if (data) {
      filled.push({
        ...data,
        completed: Number(data.completed),
        failed: Number(data.failed),
      })
    } else {
      filled.push({ timestamp: ts, completed: 0, failed: 0 })
    }
  }
  return filled
}

export const POST = createAuthenticatedApiRoute({
  apiRoute: getQueuesTableApiRoute,
  async handler(input) {
    const { search, timePeriod, sortBy, sortDirection } = input
    const cursorDirection = input.cursorDirection ?? "next"
    const cursor = input.cursor
    const limit = input.limit ?? 20
    const timePeriodDays = Number(timePeriod)
    const dateFrom = new Date(Date.now() - timePeriodDays * 24 * 60 * 60 * 1000)
    const dateTo = new Date()
    const pressureDateFrom = startOfUtcHour(dateFrom)
    const pressureDateTo = startOfUtcHour(dateTo)

    const queuePage = await listQueues({
      search,
      cursor,
      cursorDirection,
      sortBy,
      sortDirection,
      limit,
      pressureDateFrom,
      pressureDateTo,
    })
    const queueRows = queuePage.queues
    const queueNames = queueRows.map((row) => row.name)

    const interval = timePeriodDays <= 7 ? "hour" : "day"
    const currentHourStart = startOfUtcHour(dateTo)
    const chartDateFrom = interval === "hour" ? startOfUtcHour(dateFrom) : startOfUtcDay(dateFrom)

    // Performance logging
    const performanceStart = Date.now()

    const pressureStart = Date.now()
    const allPressureDataPromise: Promise<{ queueName: string; pressure: number | null }[]> =
      queueNames.length > 0
        ? db
            .select({
              queueName: dashboardQueueHourlyStatsTable.queue,
              pressure: sql<number | null>`ROUND(
                SUM(${dashboardQueueHourlyStatsTable.pressureTotalMs})::numeric
                / NULLIF(SUM(${dashboardQueueHourlyStatsTable.pressureCount}), 0)
              )`.as("pressure"),
            })
            .from(dashboardQueueHourlyStatsTable)
            .where(
              and(
                inArray(dashboardQueueHourlyStatsTable.queue, queueNames),
                gte(dashboardQueueHourlyStatsTable.bucketStart, pressureDateFrom),
                lt(dashboardQueueHourlyStatsTable.bucketStart, pressureDateTo),
              ),
            )
            .groupBy(dashboardQueueHourlyStatsTable.queue)
        : Promise.resolve([])

    // Completed hours come from compact rollups; only the current partial hour reads job_runs.
    const chartStart = Date.now()
    const historicalChartDataPromise: Promise<ChartDataRow[]> =
      queueNames.length > 0
        ? db
            .select({
              queueName: dashboardQueueHourlyStatsTable.queue,
              timestamp:
                interval === "hour"
                  ? sql<string>`(EXTRACT(EPOCH FROM ${dashboardQueueHourlyStatsTable.bucketStart}) * 1000)::bigint`.as(
                      "timestamp",
                    )
                  : sql<string>`(EXTRACT(EPOCH FROM date_trunc('day', ${dashboardQueueHourlyStatsTable.bucketStart})) * 1000)::bigint`.as(
                      "timestamp",
                    ),
              completed: sql<number>`SUM(${dashboardQueueHourlyStatsTable.completedRuns})`,
              failed: sql<number>`SUM(${dashboardQueueHourlyStatsTable.failedRuns})`,
            })
            .from(dashboardQueueHourlyStatsTable)
            .where(
              and(
                inArray(dashboardQueueHourlyStatsTable.queue, queueNames),
                gte(dashboardQueueHourlyStatsTable.bucketStart, chartDateFrom),
                lt(dashboardQueueHourlyStatsTable.bucketStart, currentHourStart),
              ),
            )
            .groupBy(dashboardQueueHourlyStatsTable.queue, sql`timestamp`)
            .orderBy(dashboardQueueHourlyStatsTable.queue, sql`timestamp`)
        : Promise.resolve([])

    const currentHourChartDataPromise: Promise<ChartDataRow[]> =
      queueNames.length > 0
        ? db
            .select({
              queueName: jobRunsTable.queue,
              timestamp:
                interval === "hour"
                  ? sql<string>`(EXTRACT(EPOCH FROM date_trunc('hour', ${jobRunsTable.createdAt})) * 1000)::bigint`.as(
                      "timestamp",
                    )
                  : sql<string>`(EXTRACT(EPOCH FROM date_trunc('day', ${jobRunsTable.createdAt})) * 1000)::bigint`.as(
                      "timestamp",
                    ),
              completed: sql<number>`COUNT(*) FILTER (WHERE ${jobRunsTable.status} = 'completed')`,
              failed: sql<number>`COUNT(*) FILTER (WHERE ${jobRunsTable.status} = 'failed')`,
            })
            .from(jobRunsTable)
            .where(
              and(
                inArray(jobRunsTable.queue, queueNames),
                gte(jobRunsTable.createdAt, currentHourStart),
                lt(jobRunsTable.createdAt, dateTo),
              ),
            )
            .groupBy(jobRunsTable.queue, sql`timestamp`)
            .orderBy(jobRunsTable.queue, sql`timestamp`)
        : Promise.resolve([])

    const [allPressureData, historicalChartData, currentHourChartData] = await Promise.all([
      allPressureDataPromise,
      historicalChartDataPromise,
      currentHourChartDataPromise,
    ])

    const pressureTime = Date.now() - pressureStart

    const chartTime = Date.now() - chartStart

    // Process the results in memory instead of making individual DB calls
    const processStart = Date.now()

    // Create maps for efficient lookup
    const pressureMap = new Map(
      allPressureData.map((pressure) => [pressure.queueName, Number(pressure.pressure ?? 0)]),
    )

    const chartDataMap = new Map<string, Map<string, ChartDataPoint>>()
    for (const chart of [...historicalChartData, ...currentHourChartData]) {
      const chartData = chartDataMap.get(chart.queueName) ?? new Map<string, ChartDataPoint>()
      const timestamp = new Date(Number(chart.timestamp)).toISOString()
      const previous = chartData.get(timestamp)

      chartData.set(timestamp, {
        timestamp,
        completed: Number(previous?.completed ?? 0) + Number(chart.completed),
        failed: Number(previous?.failed ?? 0) + Number(chart.failed),
      })
      chartDataMap.set(chart.queueName, chartData)
    }

    const queueStats = queueNames.map((queueName) => {
      const chartData = [...(chartDataMap.get(queueName)?.values() ?? [])]

      return {
        queueName,
        pressure: pressureMap.get(queueName) ?? 0,
        chartData: fillChartData(dateFrom, dateTo, interval, chartData),
      }
    })

    const processTime = Date.now() - processStart
    const totalTime = Date.now() - performanceStart
    if (totalTime > 1000) {
      console.log(
        `[Performance] Total queue stats calculation completed in ${totalTime}ms (Pressure: ${pressureTime}ms, Chart: ${chartTime}ms, Process: ${processTime}ms)`,
      )
    }

    const statsMap = new Map(queueStats.map((stat) => [stat.queueName, stat]))

    return {
      queues: queueRows.map((row) => {
        const stats = statsMap.get(row.name) ?? {
          queueName: row.name,
          pressure: 0,
          chartData: [],
        }

        return {
          name: row.name,
          isPaused: row.isPaused,
          patterns: row.patterns?.filter(Boolean) ?? [],
          everys: row.everys?.filter(Boolean) ?? [],
          waitingJobs: row.waitingJobs,
          activeJobs: row.activeJobs,
          pressure: stats.pressure,
          chartData: stats.chartData,
        }
      }),
      nextCursor: queuePage.nextCursor,
      prevCursor: queuePage.prevCursor,
      total: queuePage.total,
    }
  },
})
