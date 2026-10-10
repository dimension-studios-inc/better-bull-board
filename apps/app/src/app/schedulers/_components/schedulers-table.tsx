"use client"

import { Badge } from "@better-bull-board/ui/components/badge"
import { Button } from "@better-bull-board/ui/components/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@better-bull-board/ui/components/input-group"
import { ScrollArea, ScrollBar } from "@better-bull-board/ui/components/scroll-area"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@better-bull-board/ui/components/table"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { cn } from "cn"
import { formatDistanceToNowStrict } from "date-fns"
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, CircleAlert, Search } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createParser, parseAsString, useQueryStates } from "nuqs"
import { useRef, useState } from "react"
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

type SchedulersPage = output<typeof getSchedulersTableApiRoute.outputSchema>
type Scheduler = SchedulersPage["schedulers"][number]
type SchedulerCursor = NonNullable<SchedulersPage["nextCursor"]>

// Missed runs only show up when time passes, not when data changes
const REFETCH_INTERVAL_MS = 30_000

const isInteractiveRowTarget = (target: EventTarget | null) =>
  target instanceof Element && !!target.closest("a,button,input,select,textarea")

const parseAsCursor = createParser<SchedulerCursor>({
  parse: (value) => {
    try {
      return JSON.parse(Buffer.from(value, "base64").toString("utf-8")) as SchedulerCursor
    } catch {
      return null
    }
  },
  serialize: (value) => Buffer.from(JSON.stringify(value)).toString("base64"),
})

function Timestamp({ value, compact = false }: { value: Date; compact?: boolean }) {
  const absolute = formatUtcDateTime(value)

  return (
    <time dateTime={value.toISOString()} title={absolute}>
      <span className="block truncate">
        {formatDistanceToNowStrict(value, { addSuffix: true })}
      </span>
      {!compact && <span className="block truncate text-xs text-muted-foreground">{absolute}</span>}
    </time>
  )
}

function NextRun({
  scheduler,
  fetchedAt,
  compact = false,
}: {
  scheduler: Scheduler
  /** When the schedulers were fetched, so an end date is compared with the data it came with */
  fetchedAt: number
  compact?: boolean
}) {
  if (!scheduler.nextRunAt) {
    const hasEnded = scheduler.endDate !== null && scheduler.endDate.getTime() < fetchedAt
    return <span className="text-muted-foreground">{hasEnded ? "Ended" : "-"}</span>
  }

  return (
    <div className="flex min-w-0 items-start gap-2">
      <div className={cn("min-w-0", scheduler.isMissed && "text-destructive")}>
        <Timestamp value={scheduler.nextRunAt} compact={compact} />
      </div>
      {scheduler.isMissed && (
        <Badge
          variant="destructive"
          className="shrink-0"
          title="This run should have started by now"
        >
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
    cursor: parseAsCursor,
    cursorDirection: parseAsString.withDefault("next"),
  })

  const cursorHistoryRef = useRef<(SchedulerCursor | null)[]>([])
  const sortDirection = urlState.sortDirection === "desc" ? "desc" : "asc"
  const cursorDirection = urlState.cursorDirection === "prev" ? "prev" : "next"
  const debouncedSearch = useDebounce(urlState.search, 300)
  const options = {
    queue: urlState.queue,
    search: debouncedSearch,
    sortDirection,
    cursor: urlState.cursor,
    cursorDirection,
  } as const

  const { data, dataUpdatedAt, isLoading } = useQuery({
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

  const handleNextPage = () => {
    if (data?.nextCursor) {
      cursorHistoryRef.current.push(urlState.cursor)
      void setUrlState({ cursor: data.nextCursor, cursorDirection: "next" })
    }
  }

  // Like the runs table: Previous returns to the cursor of the page it came from, so the first page drops the
  // cursor from the URL. The server's prevCursor only serves when there is no history (a reloaded page).
  const handlePrevPage = () => {
    const previousCursor = cursorHistoryRef.current.pop()
    if (previousCursor !== undefined) {
      void setUrlState({ cursor: previousCursor, cursorDirection: "next" })
    } else if (data?.prevCursor) {
      void setUrlState({ cursor: data.prevCursor, cursorDirection: "prev" })
    } else {
      void setUrlState({ cursor: null, cursorDirection: "next" })
    }
  }

  // Filters and sort go back to the first page
  const firstPage = () => {
    cursorHistoryRef.current = []
    return { cursor: null, cursorDirection: "next" } as const
  }

  const handleSort = () => {
    void setUrlState({ ...firstPage(), sortDirection: sortDirection === "asc" ? "desc" : "asc" })
  }

  const sortIcon =
    sortDirection === "asc" ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />

  const emptyState = !isLoading && schedulers.length === 0 && (
    <p className="py-10 text-center text-sm text-muted-foreground">No schedulers found</p>
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <QueueSelector
          value={urlState.queue}
          onValueChange={(queue) => void setUrlState({ ...firstPage(), queue })}
          search={queueSearch}
          setSearch={setQueueSearch}
          open={queueOpen}
          setOpen={setQueueOpen}
          placeholder="All Queues"
          className="w-full sm:w-56"
          includeAllOption={true}
          allOptionLabel="All Queues"
        />
        <InputGroup className="sm:w-auto sm:max-w-87.5 sm:flex-1">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            placeholder="Search by scheduler or queue..."
            value={urlState.search}
            onChange={(e) => void setUrlState({ ...firstPage(), search: e.target.value })}
          />
        </InputGroup>
        <div className="ml-auto flex items-center gap-2">
          {data && (
            <span className="text-sm text-muted-foreground">
              {data.total} {data.total === 1 ? "scheduler" : "schedulers"}
            </span>
          )}
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
          <div
            key={scheduler.id}
            // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- the card contains a nested link to the last run, which an <a> cannot wrap
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
                <NextRun scheduler={scheduler} fetchedAt={dataUpdatedAt} compact />
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
      <div className="hidden overflow-hidden rounded-lg border md:block">
        <ScrollArea>
          <Table className="w-full table-fixed">
            <TableHeader className="z-10">
              <TableRow>
                <TableHead className="w-50">Queue</TableHead>
                <TableHead className="w-55">Scheduler</TableHead>
                <TableHead className="w-65">Schedule</TableHead>
                <TableHead className="w-60">
                  <button
                    type="button"
                    className="flex items-center gap-1 font-medium"
                    onClick={handleSort}
                  >
                    Next Run
                    {sortIcon}
                  </button>
                </TableHead>
                <TableHead className="w-55">Last Run</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schedulers.map((scheduler) => (
                <TableRow
                  key={scheduler.id}
                  className="cursor-pointer"
                  onClick={(event) => handleRowClick(event, scheduler)}
                >
                  <TableCell>
                    <TruncatedTooltip value={scheduler.queue} />
                  </TableCell>
                  <TableCell>
                    <TruncatedTooltip value={scheduler.key} className="font-medium" />
                    {scheduler.name !== scheduler.key && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {scheduler.name}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="block truncate">{describeSchedule(scheduler)}</span>
                    <span className="block truncate font-mono text-xs text-muted-foreground">
                      {scheduler.pattern ??
                        (scheduler.every !== null ? `${scheduler.every} ms` : "")}
                    </span>
                  </TableCell>
                  <TableCell>
                    <NextRun scheduler={scheduler} fetchedAt={dataUpdatedAt} />
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
    </div>
  )
}
