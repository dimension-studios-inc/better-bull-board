"use client"

import { Badge } from "@better-bull-board/ui/components/badge"
import { Button } from "@better-bull-board/ui/components/button"
import { Checkbox } from "@better-bull-board/ui/components/checkbox"
import { ScrollArea, ScrollBar } from "@better-bull-board/ui/components/scroll-area"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@better-bull-board/ui/components/table"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { cn } from "cn"
import { formatDistanceStrict, formatDistanceToNowStrict } from "date-fns"
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { useRouter } from "next/navigation"
import { createParser, parseAsString, useQueryStates } from "nuqs"
import { useMemo, useRef, useState } from "react"
import { countJobsApiRoute } from "~/app/api/jobs/count/schemas"
import { getStuckRunsApiRoute } from "~/app/api/jobs/stuck/schemas"
import { getJobsTableApiRoute } from "~/app/api/jobs/table/schemas"
import { RunStatusBadge } from "~/components/run-status-badge"
import { TruncatedTooltip } from "~/components/truncated-tooltip"
import useDebounce from "~/hooks/use-debounce"
import { apiFetch } from "~/lib/utils/client"
import { formatUtcDateTime } from "~/lib/utils/date"
import { describeStuckRun, STUCK_RUNS_REFETCH_INTERVAL_MS, type StuckRun } from "~/lib/utils/stuck-runs"
import { BulkActions, formatRunCount, type TMatchingFilters } from "./bulk-actions"
import { RunActions } from "./run-actions"
import { RunErrorPreview } from "./run-error-preview"
import { RunsFilters } from "./runs-filters"
import type { TRunFilters, TRunFilterUpdate } from "./types"

const parseAsCursor = createParser<NonNullable<TRunFilters["cursor"]>>({
  parse: (value) => {
    try {
      return JSON.parse(Buffer.from(value, "base64").toString("utf-8"))
    } catch {
      return null
    }
  },
  serialize: (value) => Buffer.from(JSON.stringify(value)).toString("base64"),
})

const formatRunTimestamp = (value: Date) => ({
  absolute: formatUtcDateTime(value),
  relative: formatDistanceToNowStrict(value, { addSuffix: true }),
})

type RunTimestampProps = {
  value: Date
}

function RunTimestamp({ value }: RunTimestampProps) {
  const timestamp = formatRunTimestamp(value)

  return (
    <time dateTime={value.toISOString()} title={timestamp.absolute}>
      <span className="block truncate">{timestamp.relative}</span>
      <span className="block truncate text-xs text-muted-foreground">{timestamp.absolute}</span>
    </time>
  )
}

type StuckRunWarningProps = {
  stuckRun: StuckRun | undefined
}

function StuckRunWarning({ stuckRun }: StuckRunWarningProps) {
  if (!stuckRun) return null

  const description = describeStuckRun(stuckRun)

  return (
    <span role="img" aria-label={`Looks stuck. ${description}`} title={`Looks stuck. ${description}`}>
      <AlertTriangle className="size-4 text-amber-500" />
    </span>
  )
}

// The shadcn Checkbox shows a check for the indeterminate state too: show a dash on a filled box instead
const INDETERMINATE_CHECKBOX_CLASS_NAME =
  "data-indeterminate:border-primary data-indeterminate:bg-primary data-indeterminate:text-primary-foreground data-indeterminate:[&_svg]:hidden data-indeterminate:before:h-0.5 data-indeterminate:before:w-2 data-indeterminate:before:rounded-full data-indeterminate:before:bg-current"

const isInteractiveRowTarget = (target: EventTarget | null) =>
  target instanceof Element && !!target.closest("a,button,input,select,textarea,[role='checkbox']")

const openRunInNewPage = (runPath: string) => {
  window.open(runPath, "_blank", "noopener,noreferrer")
}

const handleRowAuxClick = (event: React.MouseEvent<HTMLElement>, runPath: string) => {
  if (event.button !== 1 || isInteractiveRowTarget(event.target)) return

  event.preventDefault()
  openRunInNewPage(runPath)
}

export function RunsTable() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [urlFilters, setUrlFilters] = useQueryStates({
    queue: parseAsString.withDefault("all"),
    status: parseAsString.withDefault("all"),
    search: parseAsString.withDefault(""),
    tags: parseAsString.withDefault(""),
    createdFrom: parseAsString.withDefault(""),
    createdTo: parseAsString.withDefault(""),
    sortBy: parseAsString.withDefault("createdAt"),
    sortDirection: parseAsString.withDefault("desc"),
    cursor: parseAsCursor,
    cursorDirection: parseAsString.withDefault("next"),
  })

  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set())
  const [selectAllMatching, setSelectAllMatching] = useState(false)
  const [liveUpdatesPaused, setLiveUpdatesPaused] = useState(false)
  const cursorHistoryRef = useRef<TRunFilters["cursor"][]>([])
  const cursorCreatedAt = urlFilters.cursor?.createdAt
  const cursorJobId = urlFilters.cursor?.jobId
  const cursorId = urlFilters.cursor?.id
  const cursorDurationMs = urlFilters.cursor?.durationMs

  const filters: TRunFilters = useMemo(
    () => ({
      queue: urlFilters.queue,
      status: urlFilters.status,
      search: urlFilters.search,
      createdFrom: urlFilters.createdFrom,
      createdTo: urlFilters.createdTo,
      tags: urlFilters.tags ? urlFilters.tags.split(",").filter(Boolean) : [],
      sortBy: urlFilters.sortBy === "durationMs" ? "durationMs" : "createdAt",
      sortDirection: urlFilters.sortDirection === "asc" ? "asc" : "desc",
      cursor:
        cursorCreatedAt && cursorJobId && cursorId
          ? {
              createdAt: cursorCreatedAt,
              jobId: cursorJobId,
              id: cursorId,
              durationMs: cursorDurationMs,
            }
          : null,
      cursorDirection: urlFilters.cursorDirection === "prev" ? "prev" : "next",
      limit: 15,
    }),
    [
      urlFilters.queue,
      urlFilters.status,
      urlFilters.search,
      urlFilters.tags,
      urlFilters.createdFrom,
      urlFilters.createdTo,
      urlFilters.sortBy,
      urlFilters.sortDirection,
      cursorCreatedAt,
      cursorJobId,
      cursorId,
      cursorDurationMs,
      urlFilters.cursorDirection,
    ],
  )

  const debouncedFilters = useDebounce(filters, 300)
  const queryFilters = filters.cursor || filters.cursorDirection === "prev" ? filters : debouncedFilters
  const liveQueryKey = useMemo(() => ["jobs/table", queryFilters] as const, [queryFilters])

  const { data: runs, isFetching } = useQuery({
    queryKey: liveUpdatesPaused ? (["jobs/table-paused", queryFilters] as const) : liveQueryKey,
    queryFn: apiFetch({
      apiRoute: getJobsTableApiRoute,
      body: queryFilters,
    }),
    initialData: liveUpdatesPaused ? () => queryClient.getQueryData(liveQueryKey) : undefined,
    staleTime: liveUpdatesPaused ? Number.POSITIVE_INFINITY : undefined,
  })

  const clearSelection = () => {
    setSelectedJobIds(new Set())
    setSelectAllMatching(false)
  }

  const handleFiltersChange = (newFilters: TRunFilterUpdate) => {
    const isPaginationOnly = Object.keys(newFilters).every((key) => key === "cursor" || key === "cursorDirection")
    const urlUpdate: Record<string, unknown> = isPaginationOnly ? {} : { cursor: null, cursorDirection: "next" }

    if (isPaginationOnly && newFilters.cursorDirection === "next") {
      cursorHistoryRef.current.push(filters.cursor)
    }

    if (isPaginationOnly && newFilters.cursorDirection === "prev") {
      const previousCursor = cursorHistoryRef.current.pop()

      if (previousCursor !== undefined) {
        newFilters = { cursor: previousCursor, cursorDirection: "next" }
      }
    }

    if (!isPaginationOnly) {
      cursorHistoryRef.current = []
    }

    for (const [key, value] of Object.entries(newFilters)) {
      if (key === "tags" && Array.isArray(value)) {
        urlUpdate[key] = value.length > 0 ? value.join(",") : ""
      } else {
        urlUpdate[key] = value
      }
    }

    clearSelection()
    setUrlFilters(urlUpdate)
  }

  const jobs = runs?.jobs || []

  const activeRunIds = jobs.filter((job) => job.status === "active").map((job) => job.id)
  const { data: stuckRuns } = useQuery({
    queryKey: ["jobs/stuck", { ids: activeRunIds }],
    queryFn: apiFetch({
      apiRoute: getStuckRunsApiRoute,
      body: { ids: activeRunIds, limit: 100 },
    }),
    enabled: activeRunIds.length > 0,
    refetchInterval: STUCK_RUNS_REFETCH_INTERVAL_MS,
  })
  const stuckRunsById = useMemo(() => new Map(stuckRuns?.runs.map((run) => [run.id, run])), [stuckRuns])

  const selectedJobs = useMemo(() => {
    return jobs.filter((job) => selectedJobIds.has(job.jobId))
  }, [jobs, selectedJobIds])

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedJobIds(new Set(jobs.map((job) => job.jobId)))
    } else {
      clearSelection()
    }
  }

  const handleSelectJob = (jobId: string, checked: boolean) => {
    // Like Gmail: unchecking a run falls back to the runs of the page
    setSelectAllMatching(false)
    const newSelection = new Set(selectedJobIds)
    if (checked) {
      newSelection.add(jobId)
    } else {
      newSelection.delete(jobId)
    }
    setSelectedJobIds(newSelection)
  }

  const isPageSelected = jobs.length > 0 && selectedJobIds.size === jobs.length
  const isAllSelected = selectAllMatching || isPageSelected
  const isPartiallySelected = !isAllSelected && selectedJobIds.size > 0
  const hasOtherPages = Boolean(runs?.nextCursor || runs?.prevCursor || filters.cursor)

  // Same filters as the listing on screen, so the count and the bulk actions target the runs being looked at
  const matchingFilters: TMatchingFilters = useMemo(
    () => ({
      queue: queryFilters.queue,
      status: queryFilters.status,
      search: queryFilters.search,
      tags: queryFilters.tags,
      createdFrom: queryFilters.createdFrom,
      createdTo: queryFilters.createdTo,
    }),
    [
      queryFilters.queue,
      queryFilters.status,
      queryFilters.search,
      queryFilters.tags,
      queryFilters.createdFrom,
      queryFilters.createdTo,
    ],
  )

  const { data: matchingCounts } = useQuery({
    queryKey: ["jobs/count", matchingFilters],
    queryFn: apiFetch({
      apiRoute: countJobsApiRoute,
      body: matchingFilters,
    }),
    enabled: selectAllMatching || (isPageSelected && hasOtherPages),
  })

  const canSelectAllMatching = !!matchingCounts && matchingCounts.total > jobs.length
  const matchingSelection =
    selectAllMatching && matchingCounts ? { filters: matchingFilters, counts: matchingCounts } : null

  const handleRowClick = (event: React.MouseEvent<HTMLElement>, runPath: string) => {
    if (isInteractiveRowTarget(event.target)) return

    if (event.metaKey || event.ctrlKey) {
      openRunInNewPage(runPath)
      return
    }

    router.push(runPath)
  }

  const handleDurationSort = () => {
    handleFiltersChange({
      sortBy: "durationMs",
      sortDirection: filters.sortBy === "durationMs" && filters.sortDirection === "desc" ? "asc" : "desc",
    })
  }

  const getDurationSortIcon = () => {
    if (filters.sortBy !== "durationMs") return <ArrowUpDown className="size-3.5 text-muted-foreground" />
    if (filters.sortDirection === "asc") return <ArrowUp className="size-3.5" />
    return <ArrowDown className="size-3.5" />
  }

  return (
    <div className="space-y-4">
      <RunsFilters
        filters={filters}
        setFilters={handleFiltersChange}
        runs={runs}
        isFetching={isFetching}
        liveUpdatesPaused={liveUpdatesPaused}
        onLiveUpdatesPausedChange={setLiveUpdatesPaused}
        startEndContent={
          (selectedJobs.length > 0 || matchingSelection) && (
            <BulkActions
              selectedJobs={selectedJobs}
              matchingSelection={matchingSelection}
              onClearSelection={clearSelection}
            />
          )
        }
      />
      {(selectAllMatching || (isPageSelected && hasOtherPages)) && (
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-lg border bg-muted/50 px-3 py-2 text-center text-sm">
          {matchingSelection ? (
            <>
              <span>All {formatRunCount(matchingSelection.counts.total)} matching these filters are selected.</span>
              <Button variant="link" size="sm" className="h-auto p-0" onClick={clearSelection}>
                Clear selection
              </Button>
            </>
          ) : (
            <>
              <span>All {formatRunCount(jobs.length)} on this page are selected.</span>
              {canSelectAllMatching ? (
                <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setSelectAllMatching(true)}>
                  Select all {formatRunCount(matchingCounts.total)} matching these filters
                </Button>
              ) : (
                !matchingCounts && <span className="text-muted-foreground">Counting matching runs...</span>
              )}
            </>
          )}
        </div>
      )}
      {/* Mobile: card list */}
      <div className="space-y-2 md:hidden">
        <div className="flex items-center justify-between gap-2 px-1">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Checkbox
              checked={isAllSelected}
              indeterminate={isPartiallySelected}
              onCheckedChange={handleSelectAll}
              className={INDETERMINATE_CHECKBOX_CLASS_NAME}
              aria-label="Select all jobs"
            />
            {matchingSelection
              ? `${matchingSelection.counts.total.toLocaleString()} selected`
              : selectedJobIds.size > 0
                ? `${selectedJobIds.size} selected`
                : "Select all"}
          </label>
          <button
            type="button"
            className="flex items-center gap-1 text-sm font-medium text-muted-foreground"
            onClick={handleDurationSort}
          >
            Duration
            {getDurationSortIcon()}
          </button>
        </div>
        {jobs.map((run) => {
          const runPath = `/runs/${run.id}`
          const isSelected = selectAllMatching || selectedJobIds.has(run.jobId)
          const duration =
            run.startedAt && run.finishedAt && (run.status === "completed" || run.status === "failed")
              ? formatDistanceStrict(run.startedAt, run.finishedAt)
              : null

          return (
            // biome-ignore lint/a11y/useSemanticElements: card contains nested interactive controls
            <div
              key={`${run.id}-${run.createdAt.getTime()}`}
              role="link"
              tabIndex={0}
              className={cn(
                "cursor-pointer space-y-2 rounded-lg border bg-card p-3 transition-colors active:bg-muted/50",
                isSelected && "border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950",
              )}
              onClick={(event) => handleRowClick(event, runPath)}
              onAuxClick={(event) => handleRowAuxClick(event, runPath)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !isInteractiveRowTarget(event.target)) router.push(runPath)
              }}
            >
              <div className="flex items-start gap-3">
                <Checkbox
                  className="mt-0.5"
                  checked={isSelected}
                  onCheckedChange={(checked) => handleSelectJob(run.jobId, checked as boolean)}
                  onClick={(e) => {
                    e.stopPropagation()
                  }}
                  aria-label={`Select job ${run.jobId}`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <span className="truncate text-sm font-medium">{run.queue}</span>
                    <span className="flex shrink-0 items-center gap-1">
                      {run.status === "active" && <StuckRunWarning stuckRun={stuckRunsById.get(run.id)} />}
                      <RunStatusBadge status={run.status} />
                    </span>
                  </div>
                  <div className="truncate font-mono text-xs text-muted-foreground">#{run.jobId}</div>
                </div>
              </div>
              {run.tags && run.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 pl-7">
                  {run.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="max-w-full truncate">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
              {run.status === "failed" && run.errorMessage && (
                <p className="ml-7 line-clamp-2 break-all rounded bg-destructive/10 px-2 py-1 font-mono text-xs text-destructive">
                  {run.errorMessage}
                </p>
              )}
              <div className="flex items-center justify-between gap-2 pl-7">
                <div className="min-w-0 truncate text-xs text-muted-foreground">
                  <time dateTime={run.createdAt.toISOString()} title={formatUtcDateTime(run.createdAt)}>
                    {formatDistanceToNowStrict(run.createdAt, { addSuffix: true })}
                  </time>
                  {duration && <> · {duration}</>}
                </div>
                <div className="-my-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <RunActions jobId={run.jobId} queueName={run.queue} status={run.status} />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Desktop: table */}
      <ScrollArea className="hidden rounded-lg border md:block">
        <Table className="table-fixed w-full">
          <TableHeader className="z-10">
            <TableRow>
              <TableHead style={{ width: "50px" }}>
                <div className="flex items-center">
                  <Checkbox
                    checked={isAllSelected}
                    indeterminate={isPartiallySelected}
                    onCheckedChange={handleSelectAll}
                    className={INDETERMINATE_CHECKBOX_CLASS_NAME}
                    aria-label="Select all jobs"
                  />
                </div>
              </TableHead>
              <TableHead style={{ width: "120px" }}>Job ID</TableHead>
              <TableHead style={{ width: "260px" }}>Queue</TableHead>
              <TableHead style={{ width: "180px" }}>Tags</TableHead>
              <TableHead style={{ width: "120px" }}>Status</TableHead>
              <TableHead style={{ width: "120px" }}>
                <button type="button" className="flex items-center gap-1 font-medium" onClick={handleDurationSort}>
                  Duration
                  {getDurationSortIcon()}
                </button>
              </TableHead>
              <TableHead style={{ width: "170px" }}>Created</TableHead>
              <TableHead style={{ width: "170px" }}>Finished</TableHead>
              <TableHead style={{ width: "240px" }}>Error</TableHead>
              <TableHead style={{ width: "90px" }}>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.map((run) => {
              const runPath = `/runs/${run.id}`

              return (
                <AnimatePresence key={`${run.id}-${run.createdAt.getTime()}`}>
                  <motion.tr
                    key={run.id}
                    className={cn(
                      "group border-b transition-colors hover:bg-muted/50 cursor-pointer",
                      (selectAllMatching || selectedJobIds.has(run.jobId)) && "bg-blue-50 dark:bg-blue-950",
                    )}
                    initial={{ opacity: 0, y: -100 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    layoutId={run.id}
                    onClick={(event) => handleRowClick(event, runPath)}
                    onAuxClick={(event) => handleRowAuxClick(event, runPath)}
                  >
                    <TableCell>
                      <div className="flex items-center">
                        <Checkbox
                          checked={selectAllMatching || selectedJobIds.has(run.jobId)}
                          onCheckedChange={(checked) => handleSelectJob(run.jobId, checked as boolean)}
                          onClick={(e) => {
                            e.stopPropagation()
                          }}
                          aria-label={`Select job ${run.jobId}`}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      <TruncatedTooltip value={run.jobId} />
                    </TableCell>
                    <TableCell>
                      <TruncatedTooltip value={run.queue} />
                    </TableCell>
                    <TableCell className="overflow-hidden">
                      {run.tags?.map((tag) => (
                        <Badge key={tag} variant="outline">
                          {tag}
                        </Badge>
                      ))}
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1">
                        <RunStatusBadge status={run.status} />
                        {run.status === "active" && <StuckRunWarning stuckRun={stuckRunsById.get(run.id)} />}
                      </span>
                    </TableCell>
                    <TableCell>
                      {run.startedAt && run.finishedAt && (run.status === "completed" || run.status === "failed")
                        ? formatDistanceStrict(run.startedAt, run.finishedAt)
                        : "-"}
                    </TableCell>
                    <TableCell className="truncate">
                      <RunTimestamp value={run.createdAt} />
                    </TableCell>
                    <TableCell className="truncate">
                      {run.finishedAt ? <RunTimestamp value={run.finishedAt} /> : "-"}
                    </TableCell>
                    <TableCell>
                      {run.status === "failed" && run.errorMessage ? (
                        <RunErrorPreview
                          errorMessage={run.errorMessage}
                          runPath={runPath}
                          attempt={run.attempt}
                          maxAttempts={run.maxAttempts}
                          finishedAt={run.finishedAt}
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="transition-opacity duration-200 pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 focus-within:opacity-100">
                        <RunActions jobId={run.jobId} queueName={run.queue} status={run.status} />
                      </div>
                    </TableCell>
                  </motion.tr>
                </AnimatePresence>
              )
            })}
          </TableBody>
        </Table>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  )
}
