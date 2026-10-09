"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@better-bull-board/ui/components/card"
import { Skeleton } from "@better-bull-board/ui/components/skeleton"
// Only loaded through next/dynamic, so recharts stays out of the initial bundle
// react-doctor-disable-next-line react-doctor/prefer-dynamic-import
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
  XAxis,
  YAxis,
} from "recharts"
import type { z } from "zod"

import { CHART_RESIZE_DEBOUNCE_MS, getTimeFormats } from "~/app/_components/chart-config"
import type { queueSummaryGraphOutput } from "~/app/api/queues/summary/schemas"
import { formatUtc } from "~/lib/utils/date"
import { formatDurationMs } from "~/lib/utils/duration"

type GraphPoint = z.output<typeof queueSummaryGraphOutput>

interface QueueChartProps {
  minutes: number
  periodLabel: string
  graph: GraphPoint[] | undefined
  isLoading: boolean
}

type Series = {
  key: keyof GraphPoint
  label: string
  color: string
  format: (value: number) => string
}

const formatCount = (value: number) => value.toLocaleString()
const formatPercent = (value: number) => `${value.toFixed(1)}%`

const axisTick = { fontSize: 12, fill: "var(--muted-foreground)" }

const createTooltipContent =
  ({ tooltipFormat, series }: { tooltipFormat: string; series: Series[] }) =>
  ({ active, payload }: TooltipContentProps) => {
    if (active && payload?.length) {
      const data = payload[0]?.payload as GraphPoint
      return (
        <div className="rounded-lg border bg-background px-2.5 py-1.5 text-xs shadow-xl">
          <p className="font-medium">{`${formatUtc(data.timestamp, tooltipFormat)} UTC`}</p>
          {series.map((item) => {
            const value = data[item.key]
            return (
              <p key={item.key} className="flex items-center gap-1.5 text-muted-foreground">
                <span className="size-2 rounded-xs" style={{ backgroundColor: item.color }} />
                {item.label}:{" "}
                <span className="font-mono font-medium text-foreground">
                  {typeof value === "number" ? item.format(value) : "-"}
                </span>
              </p>
            )
          })}
        </div>
      )
    }
    return null
  }

function ChartLegend({ series }: { series: Series[] }) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
      {series.map((item) => (
        <span key={item.key} className="flex items-center gap-1.5">
          <span className="size-2 rounded-xs" style={{ backgroundColor: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  )
}

function ChartCard({
  title,
  description,
  series,
  isLoading,
  emptyMessage,
  children,
}: {
  title: string
  description: string
  series: Series[]
  isLoading: boolean
  /** Shown instead of the chart, when set */
  emptyMessage: string | null
  children: React.ReactElement
}) {
  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription className="space-y-2">
          <p>{description}</p>
          <ChartLegend series={series} />
        </CardDescription>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center sm:h-80">
            <Skeleton className="h-full w-full" />
          </div>
        ) : emptyMessage ? (
          <div className="flex h-64 items-center justify-center sm:h-80">
            <p className="text-muted-foreground">{emptyMessage}</p>
          </div>
        ) : (
          <div className="h-64 sm:h-80">
            <ResponsiveContainer width="100%" height="100%" debounce={CHART_RESIZE_DEBOUNCE_MS}>
              {children}
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

const getChartData = (graph: GraphPoint[] | undefined, minutes: number) => {
  const { axis } = getTimeFormats(minutes)
  return (
    graph?.map((point) => ({ ...point, formattedTime: formatUtc(point.timestamp, axis) })) ?? []
  )
}

const runSeries: Series[] = [
  { key: "completed", label: "Completed", color: "var(--success)", format: formatCount },
  { key: "failed", label: "Failed", color: "var(--destructive)", format: formatCount },
]

export function QueueRunsChart({ minutes, periodLabel, graph, isLoading }: QueueChartProps) {
  const chartData = getChartData(graph, minutes)
  const hasRuns = chartData.some((point) => point.completed > 0 || point.failed > 0)

  return (
    <ChartCard
      title="Runs"
      description={`Completed and failed runs created in the ${periodLabel.toLowerCase()} (times in UTC)`}
      series={runSeries}
      isLoading={isLoading}
      emptyMessage={hasRuns ? null : "No completed or failed runs in the selected period"}
    >
      <BarChart data={chartData} margin={{ left: 0, right: 12 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis
          dataKey="formattedTime"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={32}
          tick={axisTick}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={48}
          allowDecimals={false}
          tick={axisTick}
          tickFormatter={formatCount}
        />
        <Tooltip
          content={createTooltipContent({
            tooltipFormat: getTimeFormats(minutes).tooltip,
            series: runSeries,
          })}
          cursor={{ fill: "var(--muted)", opacity: 0.5 }}
        />
        {runSeries.map((item, index) => (
          <Bar
            key={item.key}
            dataKey={item.key}
            name={item.label}
            stackId="runs"
            fill={item.color}
            // Round the top of the stack only
            radius={index === runSeries.length - 1 ? [4, 4, 0, 0] : 0}
          />
        ))}
      </BarChart>
    </ChartCard>
  )
}

const errorRateSeries: Series[] = [
  { key: "errorRate", label: "Error rate", color: "var(--destructive)", format: formatPercent },
]

export function QueueErrorRateChart({ minutes, periodLabel, graph, isLoading }: QueueChartProps) {
  const chartData = getChartData(graph, minutes)
  const hasRuns = chartData.some((point) => point.errorRate != null)

  return (
    <ChartCard
      title="Error Rate"
      description={`Failed out of all runs created in the ${periodLabel.toLowerCase()}`}
      series={errorRateSeries}
      isLoading={isLoading}
      emptyMessage={hasRuns ? null : "No runs in the selected period"}
    >
      <AreaChart data={chartData} margin={{ left: 0, right: 12 }}>
        <defs>
          <linearGradient id="fillErrorRate" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--destructive)" stopOpacity={0.6} />
            <stop offset="95%" stopColor="var(--destructive)" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis
          dataKey="formattedTime"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={32}
          tick={axisTick}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={48}
          domain={[0, 100]}
          tick={axisTick}
          tickFormatter={(value) => `${value}%`}
        />
        <Tooltip
          content={createTooltipContent({
            tooltipFormat: getTimeFormats(minutes).tooltip,
            series: errorRateSeries,
          })}
          cursor={{ stroke: "var(--border)" }}
        />
        <Area
          type="monotone"
          dataKey="errorRate"
          name="Error rate"
          fill="url(#fillErrorRate)"
          stroke="var(--destructive)"
          strokeWidth={2}
          // Buckets without runs have no rate: bridge them rather than drawing a drop to 0%
          connectNulls
        />
      </AreaChart>
    </ChartCard>
  )
}

const durationSeries: Series[] = [
  { key: "p50DurationMs", label: "p50", color: "var(--chart-2)", format: formatDurationMs },
  { key: "p95DurationMs", label: "p95", color: "var(--chart-5)", format: formatDurationMs },
]

export function QueueDurationChart({ minutes, periodLabel, graph, isLoading }: QueueChartProps) {
  const chartData = getChartData(graph, minutes)
  const hasDurations = chartData.some((point) => point.p50DurationMs != null)

  return (
    <ChartCard
      title="Duration"
      description={`Completed runs created in the ${periodLabel.toLowerCase()}`}
      series={durationSeries}
      isLoading={isLoading}
      emptyMessage={hasDurations ? null : "No completed runs in the selected period"}
    >
      <LineChart data={chartData} margin={{ left: 0, right: 12 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis
          dataKey="formattedTime"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={32}
          tick={axisTick}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={56}
          tick={axisTick}
          tickFormatter={formatDurationMs}
        />
        <Tooltip
          content={createTooltipContent({
            tooltipFormat: getTimeFormats(minutes).tooltip,
            series: durationSeries,
          })}
          cursor={{ stroke: "var(--border)" }}
        />
        {durationSeries.map((item) => (
          <Line
            key={item.key}
            type="monotone"
            dataKey={item.key}
            name={item.label}
            stroke={item.color}
            strokeWidth={2}
            dot={false}
            connectNulls
          />
        ))}
      </LineChart>
    </ChartCard>
  )
}
