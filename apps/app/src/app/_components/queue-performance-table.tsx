"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@better-bull-board/ui/components/card"
import { ScrollArea, ScrollBar } from "@better-bull-board/ui/components/scroll-area"
import { Skeleton } from "@better-bull-board/ui/components/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@better-bull-board/ui/components/table"
import { cn } from "cn"
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import type { z } from "zod"
import type { dashboardQueuePerformanceOutput } from "~/app/api/dashboard/summary/schemas"
import { TruncatedTooltip } from "~/components/truncated-tooltip"
import { getRunsHref } from "~/lib/utils/runs-link"

type QueuePerformance = z.output<typeof dashboardQueuePerformanceOutput>

interface QueuePerformanceTableProps {
  /** Dashboard period, so the runs links list the runs these counts are made of */
  minutes: number
  queuePerformance: QueuePerformance[] | undefined
  isLoading: boolean
}

type SortKey = keyof Pick<
  QueuePerformance,
  "queue" | "totalRuns" | "successes" | "failures" | "errorRate" | "avgDuration" | "minDuration" | "maxDuration"
>
type SortDirection = "asc" | "desc"

const sortableColumns: { key: SortKey; label: string; align?: "right" }[] = [
  { key: "queue", label: "Queue" },
  { key: "totalRuns", label: "Total Runs", align: "right" },
  { key: "successes", label: "Success", align: "right" },
  { key: "failures", label: "Failed", align: "right" },
  { key: "errorRate", label: "Error Rate", align: "right" },
  { key: "avgDuration", label: "Avg Duration", align: "right" },
  { key: "minDuration", label: "Min Duration", align: "right" },
  { key: "maxDuration", label: "Max Duration", align: "right" },
]

const isLinkTarget = (target: EventTarget | null) => target instanceof Element && !!target.closest("a,button")

type RunCountLinkProps = {
  count: number
  href: string
  label: string
  className?: string
}

/** Count cell opening the runs it counts; a zero has nothing to show */
function RunCountLink({ count, href, label, className }: RunCountLinkProps) {
  if (count === 0) return <span className="text-muted-foreground">0</span>

  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className={cn(
        "-mx-1.5 -my-0.5 rounded-md px-1.5 py-0.5 underline-offset-4 outline-none transition-colors hover:underline focus-visible:ring-2 focus-visible:ring-ring/50",
        className,
      )}
    >
      {count.toLocaleString()}
    </Link>
  )
}

export function QueuePerformanceTable({ minutes, queuePerformance, isLoading }: QueuePerformanceTableProps) {
  const router = useRouter()
  const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection }>({
    key: "totalRuns",
    direction: "desc",
  })

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds.toFixed(1)}s`
    if (seconds < 3600) return `${(seconds / 60).toFixed(1)}m`
    return `${(seconds / 3600).toFixed(1)}h`
  }

  const sortedQueuePerformance = useMemo(() => {
    return [...(queuePerformance ?? [])].sort((a, b) => {
      const direction = sort.direction === "asc" ? 1 : -1
      const aValue = a[sort.key]
      const bValue = b[sort.key]

      if (typeof aValue === "string" && typeof bValue === "string") {
        return aValue.localeCompare(bValue) * direction
      }

      return (Number(aValue) - Number(bValue)) * direction
    })
  }, [queuePerformance, sort])

  const handleSort = (key: SortKey) => {
    setSort((current) => ({
      key,
      direction: current.key === key && current.direction === "desc" ? "asc" : "desc",
    }))
  }

  // The whole row opens the queue runs; the cells with a link open a narrower list
  const handleRowClick = (event: React.MouseEvent<HTMLTableRowElement>, queueHref: string) => {
    if (isLinkTarget(event.target) || window.getSelection()?.toString()) return

    if (event.metaKey || event.ctrlKey) {
      window.open(queueHref, "_blank", "noopener,noreferrer")
      return
    }

    router.push(queueHref)
  }

  const getSortIcon = (key: SortKey) => {
    if (sort.key !== key) return <ArrowUpDown className="size-3.5 text-muted-foreground" />
    if (sort.direction === "asc") return <ArrowUp className="size-3.5" />
    return <ArrowDown className="size-3.5" />
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Queue Performance Summary</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3 h-96">
            {Array.from({ length: 5 }).map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: skeleton
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <ScrollArea className="h-96">
            <Table className="min-w-[720px]">
              <TableHeader className="z-10">
                <TableRow>
                  {sortableColumns.map((column) => (
                    <TableHead key={column.key} className={column.align === "right" ? "text-right" : undefined}>
                      <button
                        type="button"
                        className={
                          column.align === "right"
                            ? "ml-auto flex items-center gap-1 font-medium"
                            : "flex items-center gap-1 font-medium"
                        }
                        onClick={() => handleSort(column.key)}
                      >
                        {column.label}
                        {getSortIcon(column.key)}
                      </button>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedQueuePerformance.map((queue) => {
                  const queueHref = getRunsHref({ queue: queue.queue, minutes })

                  return (
                    <TableRow
                      key={queue.queue}
                      className="group cursor-pointer"
                      onClick={(event) => handleRowClick(event, queueHref)}
                    >
                      <TableCell className="max-w-48 font-medium">
                        <Link
                          href={queueHref}
                          className="block rounded-sm underline-offset-4 outline-none group-hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
                        >
                          <TruncatedTooltip value={queue.queue} />
                        </Link>
                      </TableCell>
                      <TableCell className="text-right font-mono">{queue.totalRuns.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-mono">
                        <RunCountLink
                          count={queue.successes}
                          href={getRunsHref({ queue: queue.queue, status: "completed", minutes })}
                          label={`View completed runs of ${queue.queue}`}
                          className="text-green-600 hover:bg-green-500/10 dark:text-green-400"
                        />
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        <RunCountLink
                          count={queue.failures}
                          href={getRunsHref({ queue: queue.queue, status: "failed", minutes })}
                          label={`View failed runs of ${queue.queue}`}
                          className="text-destructive hover:bg-destructive/10"
                        />
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        <span
                          className={
                            queue.errorRate > 10
                              ? "text-destructive"
                              : queue.errorRate > 5
                                ? "text-yellow-600 dark:text-yellow-400"
                                : "text-green-600 dark:text-green-400"
                          }
                        >
                          {queue.errorRate.toFixed(1)}%
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono">{formatDuration(queue.avgDuration)}</TableCell>
                      <TableCell className="text-right font-mono">{formatDuration(queue.minDuration)}</TableCell>
                      <TableCell className="text-right font-mono">{formatDuration(queue.maxDuration)}</TableCell>
                    </TableRow>
                  )
                })}
                {!sortedQueuePerformance.length && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      No data available for the selected period
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}
