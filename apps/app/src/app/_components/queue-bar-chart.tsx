"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@better-bull-board/ui/components/card"
import { Skeleton } from "@better-bull-board/ui/components/skeleton"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
  XAxis,
  YAxis,
  type YAxisTickContentProps,
} from "recharts"

import { getRunsHref } from "~/lib/utils/runs-link"

import { CHART_RESIZE_DEBOUNCE_MS } from "./chart-config"

type QueueBarChartItem = {
  queue: string
  value: number
}

interface QueueBarChartProps {
  title: string
  /** Dashboard period, so a bar opens the runs it is made of */
  minutes: number
  data: QueueBarChartItem[] | undefined
  isLoading: boolean
  color: string
  valueLabel: string
  formatValue: (value: number) => string
}

const TICK_FONT_SIZE = 12
// Recharts draws the tick text this far from the axis: the tick size (6) plus the tick margin (2)
const TICK_OFFSET = 8
// Past this share of the chart width, the queue names are cut so the bars keep room
const MAX_LABEL_SHARE = 0.4
const DEFAULT_MAX_LABEL_WIDTH = 160

let measureContext: CanvasRenderingContext2D | null | undefined

const measureLabel = (text: string) => {
  const estimate = text.length * TICK_FONT_SIZE * 0.6
  if (typeof document === "undefined") return estimate

  if (measureContext === undefined) {
    measureContext = document.createElement("canvas").getContext("2d")
    if (measureContext)
      measureContext.font = `${TICK_FONT_SIZE}px ${getComputedStyle(document.body).fontFamily}`
  }
  return measureContext ? measureContext.measureText(text).width : estimate
}

const truncateLabel = (text: string, maxWidth: number) => {
  if (measureLabel(text) <= maxWidth) return text

  let length = text.length - 1
  while (length > 1 && measureLabel(`${text.slice(0, length)}…`) > maxWidth) length--
  return `${text.slice(0, length)}…`
}

const isModifiedClick = (event: React.MouseEvent) =>
  event.metaKey || event.ctrlKey || event.shiftKey || event.altKey

const createTooltipContent =
  ({ valueLabel, formatValue }: Pick<QueueBarChartProps, "valueLabel" | "formatValue">) =>
  ({ active, payload }: TooltipContentProps) => {
    if (active && payload?.length) {
      const data = payload[0]?.payload as QueueBarChartItem
      return (
        <div className="max-w-72 rounded border bg-background p-3 text-sm shadow-lg">
          <p className="font-medium break-all">{data.queue}</p>
          <p className="text-muted-foreground">
            {valueLabel}:{" "}
            <span className="font-mono font-medium text-foreground">{formatValue(data.value)}</span>
          </p>
        </div>
      )
    }
    return null
  }

/** Top queues as horizontal bars, each bar and queue name opening the runs of its queue */
export function QueueBarChart({
  title,
  minutes,
  data,
  isLoading,
  color,
  valueLabel,
  formatValue,
}: QueueBarChartProps) {
  const router = useRouter()
  const [chartWidth, setChartWidth] = useState(0)

  // Wide enough for the longest queue name, unless it would squeeze the bars
  const yAxisWidth = useMemo(() => {
    const maxLabelWidth = chartWidth ? chartWidth * MAX_LABEL_SHARE : DEFAULT_MAX_LABEL_WIDTH
    const longestLabelWidth = Math.max(0, ...(data ?? []).map((item) => measureLabel(item.queue)))
    return Math.ceil(Math.min(longestLabelWidth, maxLabelWidth)) + TICK_OFFSET
  }, [data, chartWidth])

  const openQueueRuns = (queue: string, event: React.MouseEvent) => {
    const href = getRunsHref({ queue, minutes })
    if (event.metaKey || event.ctrlKey) {
      window.open(href, "_blank", "noopener,noreferrer")
      return
    }

    router.push(href)
  }

  const renderQueueTick = ({ x, y, payload }: YAxisTickContentProps) => {
    const queue = String(payload.value)
    const label = truncateLabel(queue, yAxisWidth - TICK_OFFSET)
    const href = getRunsHref({ queue, minutes })

    return (
      <a
        href={href}
        aria-label={`View runs of ${queue}`}
        className="group/tick outline-none"
        // A real link, so modified clicks open a new tab or window as usual
        onClick={(event) => {
          if (isModifiedClick(event)) return
          event.preventDefault()
          router.push(href)
        }}
      >
        {label !== queue && <title>{queue}</title>}
        <text
          x={x}
          y={y}
          dy="0.355em"
          textAnchor="end"
          fontSize={TICK_FONT_SIZE}
          className="fill-muted-foreground group-hover/tick:fill-foreground group-hover/tick:underline group-focus-visible/tick:fill-foreground group-focus-visible/tick:underline"
        >
          {label}
        </text>
      </a>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex h-80 items-center justify-center">
            <Skeleton className="h-80 w-full" />
          </div>
        ) : data?.length ? (
          <div className="h-80">
            <ResponsiveContainer
              width="100%"
              height="100%"
              debounce={CHART_RESIZE_DEBOUNCE_MS}
              onResize={(width) => setChartWidth(width)}
            >
              <BarChart
                data={data}
                layout="vertical"
                margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
                className="[&_.recharts-rectangle]:cursor-pointer"
              >
                <CartesianGrid horizontal={false} stroke="var(--border)" />
                <XAxis
                  type="number"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: TICK_FONT_SIZE, fill: "var(--muted-foreground)" }}
                  tickFormatter={formatValue}
                />
                <YAxis
                  type="category"
                  dataKey="queue"
                  width={yAxisWidth}
                  interval={0}
                  tickLine={false}
                  axisLine={false}
                  tick={renderQueueTick}
                />
                <Tooltip
                  content={createTooltipContent({ valueLabel, formatValue })}
                  cursor={{ fill: "var(--muted)" }}
                />
                <Bar
                  dataKey="value"
                  fill={color}
                  radius={[0, 4, 4, 0]}
                  // The transparent track makes the whole row clickable, short bars included
                  background={{ fill: "transparent" }}
                  onClick={(entry, _index, event) =>
                    openQueueRuns((entry.payload as QueueBarChartItem).queue, event)
                  }
                  className="transition-opacity hover:opacity-80"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex h-80 items-center justify-center">
            <p className="text-muted-foreground">No data available</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
