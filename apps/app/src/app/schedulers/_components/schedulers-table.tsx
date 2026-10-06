"use client"

import { Badge } from "@better-bull-board/ui/components/badge"
import { Input } from "@better-bull-board/ui/components/input"
import { ScrollArea, ScrollBar } from "@better-bull-board/ui/components/scroll-area"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@better-bull-board/ui/components/table"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { cn } from "cn"
import { formatDistanceToNowStrict } from "date-fns"
import { ArrowDown, ArrowUp, CircleAlert, Search } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { parseAsString, useQueryStates } from "nuqs"
import { useState } from "react"
import type { output } from "zod"
import { getSchedulersTableApiRoute } from "~/app/api/schedulers/table/schemas"
import { QueueStateBadge } from "~/app/queues/_components/queue-state-badge"
import { QueueSelector } from "~/components/queue-selector"
import { RunStatusBadge } from "~/components/run-status-badge"
import { TruncatedTooltip } from "~/components/truncated-tooltip"
import useDebounce from "~/hooks/use-debounce"
import { apiFetch } from "~/lib/utils/client"
import { formatUtcDateTime } from "~/lib/utils/date"
import { getRunsHref } from "~/lib/utils/runs-link"
import { describeSchedule } from "~/lib/utils/schedule"

type Scheduler = output<typeof getSchedulersTableApiRoute.outputSchema>["schedulers"][number]

// Missed runs only show up when time passes, not when data changes
const REFETCH_INTERVAL_MS = 30_000

const isInteractiveRowTarget = (target: EventTarget | null) =>
  target instanceof Element && !!target.closest("a,button,input,select,textarea")

function Timestamp({ value, compact = false }: { value: Date; compact?: boolean }) {
  const absolute = formatUtcDateTime(value)

  return (
    <time dateTime={value.toISOString()} title={absolute}>
      <span className="block truncate">{formatDistanceToNowStrict(value, { addSuffix: true })}</span>
      {!compact && <span className="block truncate text-xs text-muted-foreground">{absolute}</span>}
    </time>
  )
}

function NextRun({ scheduler, compact = false }: { scheduler: Scheduler; compact?: boolean }) {
  if (!scheduler.nextRunAt) {
    const hasEnded = scheduler.endDate !== null && scheduler.endDate.getTime() < Date.now()
    return <span className="text-muted-foreground">{hasEnded ? "Ended" : "-"}</span>
  }

  return (
    <div className="flex min-w-0 items-start gap-2">
      <div className={cn("min-w-0", scheduler.isMissed && "text-destructive")}>
        <Timestamp value={scheduler.nextRunAt} compact={compact} />
      </div>
      {scheduler.isMissed && (
        <Badge variant="destructive" className="shrink-0" title="This run should have started by now">
          <CircleAlert data-icon="inline-start" />
          Missed
        </Badge>
      )}
      {scheduler.queueIsPaused && <QueueStateBadge isPaused className="shrink-0" />}
    </div>
  )
}

function LastRun({ scheduler, compact = false }: { scheduler: Scheduler; compact?: boolean }) {
  const { lastRun } = scheduler
  if (!lastRun) return <span className="text-muted-foreground">-</span>

  return (
    <Link href={`/runs/${lastRun.id}`} className="flex min-w-0 items-start gap-2 hover:underline">
      <RunStatusBadge status={lastRun.status} className="shrink-0" />
      <div className="min-w-0">
        <Timestamp value={lastRun.at} compact={compact} />
      </div>
    </Link>
  )
}

export function SchedulersTable() {
  const router = useRouter()
  const [queueOpen, setQueueOpen] = useState(false)
  const [queueSearch, setQueueSearch] = useState("")
  const [urlState, setUrlState] = useQueryStates({
    queue: parseAsString.withDefault("all"),
    search: parseAsString.withDefault(""),
    sortDirection: parseAsString.withDefault("asc"),
  })

  const sortDirection = urlState.sortDirection === "desc" ? "desc" : "asc"
  const debouncedSearch = useDebounce(urlState.search, 300)
  const options = { queue: urlState.queue, search: debouncedSearch, sortDirection } as const

  const { data, isLoading } = useQuery({
    queryKey: ["schedulers/table", options],
    queryFn: apiFetch({
      apiRoute: getSchedulersTableApiRoute,
      body: options,
    }),
    placeholderData: keepPreviousData,
    refetchInterval: REFETCH_INTERVAL_MS,
  })

  const schedulers = data?.schedulers ?? []

  const getSchedulerRunsHref = (scheduler: Scheduler) =>
    // Scheduler job ids are "repeat:<key>:<timestamp>", which the runs search matches
    getRunsHref({ queue: scheduler.queue, search: scheduler.key })

  const handleRowClick = (event: React.MouseEvent<HTMLElement>, scheduler: Scheduler) => {
    if (isInteractiveRowTarget(event.target)) return
    router.push(getSchedulerRunsHref(scheduler))
  }

  const handleSort = () => {
    setUrlState({ sortDirection: sortDirection === "asc" ? "desc" : "asc" })
  }

  const sortIcon = sortDirection === "asc" ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />

  const emptyState = !isLoading && schedulers.length === 0 && (
    <p className="py-10 text-center text-sm text-muted-foreground">No schedulers found</p>
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <QueueSelector
          value={urlState.queue}
          onValueChange={(queue) => setUrlState({ queue })}
          search={queueSearch}
          setSearch={setQueueSearch}
          open={queueOpen}
          setOpen={setQueueOpen}
          placeholder="All Queues"
          className="w-full sm:w-56"
          popoverContentClassName="w-80"
          includeAllOption={true}
          allOptionLabel="All Queues"
        />
        <div className="relative w-full sm:w-auto sm:flex-1 sm:max-w-[350px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by scheduler or queue..."
            value={urlState.search}
            onChange={(e) => setUrlState({ search: e.target.value })}
            className="pl-10"
          />
        </div>
        {data && (
          <span className="text-sm text-muted-foreground sm:ml-auto">
            {schedulers.length} {schedulers.length === 1 ? "scheduler" : "schedulers"}
          </span>
        )}
      </div>

      {/* Mobile: card list */}
      <div className="space-y-2 md:hidden">
        <div className="flex justify-end px-1">
          <button
            type="button"
            className="flex items-center gap-1 text-sm font-medium text-muted-foreground"
            onClick={handleSort}
          >
            Next run
            {sortIcon}
          </button>
        </div>
        {schedulers.map((scheduler) => (
          // biome-ignore lint/a11y/useSemanticElements: card contains a nested link to the last run
          <div
            key={scheduler.id}
            role="link"
            tabIndex={0}
            className={cn(
              "cursor-pointer space-y-2 rounded-lg border bg-card p-3 transition-colors active:bg-muted/50",
              scheduler.isMissed && "border-destructive/40",
            )}
            onClick={(event) => handleRowClick(event, scheduler)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !isInteractiveRowTarget(event.target)) {
                router.push(getSchedulerRunsHref(scheduler))
              }
            }}
          >
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{scheduler.key}</div>
              <div className="truncate text-xs text-muted-foreground">{scheduler.queue}</div>
            </div>
            <div className="text-sm">{describeSchedule(scheduler)}</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="min-w-0 space-y-1">
                <div className="text-muted-foreground">Next run</div>
                <NextRun scheduler={scheduler} compact />
              </div>
              <div className="min-w-0 space-y-1">
                <div className="text-muted-foreground">Last run</div>
                <LastRun scheduler={scheduler} compact />
              </div>
            </div>
          </div>
        ))}
        {emptyState}
      </div>

      {/* Desktop: table */}
      <ScrollArea className="hidden rounded-lg border md:block">
        <Table className="table-fixed w-full">
          <TableHeader className="z-10">
            <TableRow>
              <TableHead style={{ width: "200px" }}>Queue</TableHead>
              <TableHead style={{ width: "220px" }}>Scheduler</TableHead>
              <TableHead style={{ width: "260px" }}>Schedule</TableHead>
              <TableHead style={{ width: "240px" }}>
                <button type="button" className="flex items-center gap-1 font-medium" onClick={handleSort}>
                  Next Run
                  {sortIcon}
                </button>
              </TableHead>
              <TableHead style={{ width: "220px" }}>Last Run</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {schedulers.map((scheduler) => (
              <TableRow
                key={scheduler.id}
                className={cn("cursor-pointer", scheduler.isMissed && "bg-destructive/5")}
                onClick={(event) => handleRowClick(event, scheduler)}
              >
                <TableCell>
                  <TruncatedTooltip value={scheduler.queue} />
                </TableCell>
                <TableCell>
                  <TruncatedTooltip value={scheduler.key} className="font-medium" />
                  {scheduler.name !== scheduler.key && (
                    <span className="block truncate text-xs text-muted-foreground">{scheduler.name}</span>
                  )}
                </TableCell>
                <TableCell>
                  <span className="block truncate">{describeSchedule(scheduler)}</span>
                  <span className="block truncate font-mono text-xs text-muted-foreground">
                    {scheduler.pattern ?? (scheduler.every !== null ? `${scheduler.every} ms` : "")}
                  </span>
                </TableCell>
                <TableCell>
                  <NextRun scheduler={scheduler} />
                </TableCell>
                <TableCell>
                  <LastRun scheduler={scheduler} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {emptyState}
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  )
}
