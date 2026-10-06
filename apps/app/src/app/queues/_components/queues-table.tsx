"use client"

import { Button } from "@better-bull-board/ui/components/button"
import { Input } from "@better-bull-board/ui/components/input"
import { ScrollArea, ScrollBar } from "@better-bull-board/ui/components/scroll-area"
import { Skeleton } from "@better-bull-board/ui/components/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@better-bull-board/ui/components/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@better-bull-board/ui/components/tooltip"
import { useQuery } from "@tanstack/react-query"
import { formatDuration } from "date-fns"
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Info, Search } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createParser, parseAsString, useQueryStates } from "nuqs"
import { getQueuesTableApiRoute } from "~/app/api/queues/table/schemas"
import { apiFetch, smartFormatDuration } from "~/lib/utils/client"
import { getQueueHref } from "~/lib/utils/queue-link"
import { QueueActions } from "./queue-actions"
import { QueueMiniChart } from "./queue-mini-chart"
import { QueueStateBadge } from "./queue-state-badge"
import { type TimePeriod, TimePeriodSelector } from "./time-period-selector"

type QueueCursor = { waitingJobs: number; activeJobs?: number; pressure?: number; name: string }
type SortBy = "waitingJobs" | "activeJobs" | "pressure"
type SortDirection = "asc" | "desc"

const PRESSURE_DESCRIPTION =
  "Average time completed or failed jobs spend waiting before starting, from completed hourly rollups in the selected time period."

const sortableQueueColumns: { key: SortBy; label: string }[] = [
  { key: "waitingJobs", label: "Waiting Jobs" },
  { key: "activeJobs", label: "Active Jobs" },
]

const parseAsCursor = createParser<QueueCursor>({
  parse: (value) => {
    try {
      return JSON.parse(Buffer.from(value, "base64").toString("utf-8"))
    } catch {
      return null
    }
  },
  serialize: (value) => Buffer.from(JSON.stringify(value)).toString("base64"),
})

export function QueuesTable() {
  const router = useRouter()
  const [urlState, setUrlState] = useQueryStates({
    search: parseAsString.withDefault(""),
    timePeriod: parseAsString.withDefault("1"),
    cursor: parseAsCursor,
    cursorDirection: parseAsString.withDefault("next"),
    sortBy: parseAsString.withDefault("waitingJobs"),
    sortDirection: parseAsString.withDefault("desc"),
  })

  const cursorDirection: "next" | "prev" = urlState.cursorDirection === "prev" ? "prev" : "next"
  const sortBy: SortBy =
    urlState.sortBy === "activeJobs" ? "activeJobs" : urlState.sortBy === "pressure" ? "pressure" : "waitingJobs"
  const sortDirection: SortDirection = urlState.sortDirection === "asc" ? "asc" : "desc"
  const options = {
    cursor: urlState.cursor,
    cursorDirection,
    search: urlState.search,
    sortBy,
    sortDirection,
    timePeriod: urlState.timePeriod as TimePeriod,
  }

  const handleQueueClick = (queueName: string) => {
    router.push(`/runs?queue=${encodeURIComponent(queueName)}`)
  }

  const { data, isLoading } = useQuery({
    queryKey: ["queues/table", options],
    queryFn: apiFetch({
      apiRoute: getQueuesTableApiRoute,
      body: options,
    }),
  })

  const handleNextPage = () => {
    if (data?.nextCursor) {
      setUrlState({ cursor: data.nextCursor, cursorDirection: "next" })
    }
  }

  const handlePrevPage = () => {
    if (data?.prevCursor) {
      setUrlState({ cursor: data.prevCursor, cursorDirection: "prev" })
    } else {
      setUrlState({ cursor: null, cursorDirection: "next" })
    }
  }

  const handleSearchChange = (search: string) => {
    // Reset pagination when search changes
    setUrlState({ cursor: null, cursorDirection: "next", search })
  }

  const handleTimePeriodChange = (timePeriod: TimePeriod) => {
    // Reset pagination when time period changes
    setUrlState({ cursor: null, cursorDirection: "next", timePeriod })
  }

  const handleSort = (nextSortBy: SortBy) => {
    setUrlState({
      cursor: null,
      cursorDirection: "next",
      sortBy: nextSortBy,
      sortDirection: sortBy === nextSortBy && sortDirection === "desc" ? "asc" : "desc",
    })
  }

  const getSortIcon = (key: SortBy) => {
    if (sortBy !== key) return <ArrowUpDown className="size-3.5 text-muted-foreground" />
    if (sortDirection === "asc") return <ArrowUp className="size-3.5" />
    return <ArrowDown className="size-3.5" />
  }

  const selectedQueueStats = data?.queues.length === 1 ? data.queues[0] : undefined

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <TimePeriodSelector value={options.timePeriod} onChange={handleTimePeriodChange} />
        <div className="relative order-1 w-full sm:order-none sm:w-auto sm:flex-1 sm:max-w-[350px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by queue name..."
            value={options.search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
        {options.search && (isLoading || selectedQueueStats) && (
          <div className="order-1 flex h-8 items-center gap-3 rounded-lg border px-2.5 text-xs text-muted-foreground sm:order-none">
            {isLoading ? (
              <Skeleton className="h-4 w-32" />
            ) : (
              <>
                <span className="whitespace-nowrap">
                  <span className="font-mono text-foreground">{selectedQueueStats?.waitingJobs ?? 0}</span> waiting
                </span>
                <span className="whitespace-nowrap">
                  <span className="font-mono text-foreground">{selectedQueueStats?.activeJobs ?? 0}</span> active
                </span>
              </>
            )}
          </div>
        )}
        <div className="flex items-center gap-2 ml-auto">
          <Button
            variant="outline"
            onClick={handlePrevPage}
            disabled={isLoading || !data?.prevCursor}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Previous</span>
          </Button>
          <Button
            variant="outline"
            onClick={handleNextPage}
            disabled={isLoading || !data?.nextCursor}
            aria-label="Next page"
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <ScrollArea className="rounded-lg border">
        <Table className="table-fixed w-full">
          <TableHeader className="z-10">
            <TableRow>
              <TableHead style={{ width: "200px" }}>Queue Name</TableHead>
              <TableHead style={{ width: "120px" }}>Status</TableHead>
              <TableHead style={{ width: "120px" }}>Scheduler</TableHead>
              {sortableQueueColumns.map((column) => (
                <TableHead key={column.key} style={{ width: "120px" }}>
                  <button
                    type="button"
                    className="flex items-center gap-1 font-medium"
                    onClick={() => handleSort(column.key)}
                  >
                    {column.label}
                    {getSortIcon(column.key)}
                  </button>
                </TableHead>
              ))}
              <TableHead style={{ width: "240px" }}>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    className="flex items-center gap-1 font-medium"
                    onClick={() => handleSort("pressure")}
                  >
                    Pressure
                    {getSortIcon("pressure")}
                  </button>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <button
                          type="button"
                          className="rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          aria-label="What pressure means"
                        />
                      }
                    >
                      <Info className="size-3.5" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-64 text-left">{PRESSURE_DESCRIPTION}</TooltipContent>
                  </Tooltip>
                </div>
              </TableHead>
              <TableHead style={{ width: "70px" }}>Trend</TableHead>
              <TableHead style={{ width: "90px" }}></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.queues.map((queue) => (
              <AnimatePresence key={queue.name}>
                <motion.tr
                  key={queue.name}
                  className="group border-b transition-colors cursor-pointer hover:bg-muted/50 data-[state=selected]:bg-muted"
                  onClick={() => handleQueueClick(queue.name)}
                  initial={{ opacity: 0, y: -100 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                  layoutId={queue.name}
                >
                  <TableCell className="font-medium truncate">
                    <Link
                      href={getQueueHref(queue.name)}
                      onClick={(e) => e.stopPropagation()}
                      className="rounded-sm underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
                    >
                      {queue.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <QueueStateBadge isPaused={queue.isPaused} />
                  </TableCell>
                  <TableCell>
                    <span className="font-mono truncate block">
                      {queue.patterns.length
                        ? queue.patterns.join(", ")
                        : queue.everys.length
                          ? queue.everys.map(
                              (every) =>
                                `Every ${formatDuration({
                                  seconds: Number(every) / 1000,
                                })}`,
                            )
                          : undefined}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono">{queue.waitingJobs}</span>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono">{queue.activeJobs}</span>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono truncate">{smartFormatDuration(queue.pressure)}</span>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <QueueMiniChart data={queue.chartData} />
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="transition-opacity duration-200 pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 focus-within:opacity-100">
                      <QueueActions queueName={queue.name} isPaused={queue.isPaused} />
                    </div>
                  </TableCell>
                </motion.tr>
              </AnimatePresence>
            ))}
          </TableBody>
        </Table>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  )
}
