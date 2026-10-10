"use client"

import { Button } from "@better-bull-board/ui/components/button"
import { Checkbox } from "@better-bull-board/ui/components/checkbox"
import { ScrollArea, ScrollBar } from "@better-bull-board/ui/components/scroll-area"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@better-bull-board/ui/components/table"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { cn } from "cn"
import { formatDistanceToNowStrict } from "date-fns"
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"
import { AnimatePresence, m } from "motion/react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import type { output } from "zod"

import { countJobsApiRoute } from "~/app/api/jobs/count/schemas"
import { getStuckRunsApiRoute } from "~/app/api/jobs/stuck/schemas"
import { getJobsTableApiRoute } from "~/app/api/jobs/table/schemas"
import { RunStatusBadge } from "~/components/run-status-badge"
import { TruncatedTooltip } from "~/components/truncated-tooltip"
import { apiFetch } from "~/lib/utils/client"
import { formatUtcDateTime } from "~/lib/utils/date"
import { type StuckRun, STUCK_RUNS_REFETCH_INTERVAL_MS } from "~/lib/utils/stuck-runs"

import { BulkActions, type TMatchingFilters } from "./bulk-actions"
import { RunActions } from "./run-actions"
import { StuckRunWarning } from "./run-display"
import { RunErrorPreview } from "./run-error-preview"
import { formatRunCount, getRunDuration } from "./run-format"
import { RunListItem } from "./run-list-item"
import { RunTags } from "./run-tags"
import { LiveUpdatesToggle, RunsFilters, RunsPagination } from "./runs-filters"
import type { TRunFilters } from "./types"
import { useRunFilters } from "./use-run-filters"

type Run = output<typeof getJobsTableApiRoute.outputSchema>["jobs"][number]

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

function DurationSortIcon({ filters }: { filters: TRunFilters }) {
  if (filters.sortBy !== "durationMs")
    return <ArrowUpDown className="size-3.5 text-muted-foreground" />
  if (filters.sortDirection === "asc") return <ArrowUp className="size-3.5" />
  return <ArrowDown className="size-3.5" />
}

type SelectionBannerProps = {
  matchingSelection: { counts: { total: number } } | null
  pageCount: number
  matchingTotal: number | undefined
  onSelectAllMatching: () => void
  onClearSelection: () => void
}

// Like Gmail: once the whole page is selected, offer every run matching the filters
function SelectionBanner({
  matchingSelection,
  pageCount,
  matchingTotal,
  onSelectAllMatching,
  onClearSelection,
}: SelectionBannerProps) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-lg border bg-muted/50 px-3 py-2 text-center text-sm">
      {matchingSelection ? (
        <>
          <span>
            All {formatRunCount(matchingSelection.counts.total)} matching these filters are
            selected.
          </span>
          <Button variant="link" size="sm" className="h-auto" onClick={onClearSelection}>
            Clear selection
          </Button>
        </>
      ) : (
        <>
          <span>All {formatRunCount(pageCount)} on this page are selected.</span>
          {matchingTotal === undefined ? (
            <span className="text-muted-foreground">Counting matching runs...</span>
          ) : (
            matchingTotal > pageCount && (
              <Button variant="link" size="sm" className="h-auto" onClick={onSelectAllMatching}>
                Select all {formatRunCount(matchingTotal)} matching these filters
              </Button>
            )
          )}
        </>
      )}
    </div>
  )
}

type RunTableRowProps = {
  run: Run
  isSelected: boolean
  stuckRun: StuckRun | undefined
  onSelectedChange: (checked: boolean) => void
  onRowClick: (event: React.MouseEvent<HTMLElement>, runPath: string) => void
  onTagClick: (tag: string) => void
}

function RunTableRow({
  run,
  isSelected,
  stuckRun,
  onSelectedChange,
  onRowClick,
  onTagClick,
}: RunTableRowProps) {
  const runPath = `/runs/${run.id}`

  return (
    <AnimatePresence>
      {/* The whole row opens the run for pointer users; the job ID is its link for keyboard users */}
      <m.tr
        className={cn(
          "group cursor-pointer border-b transition-colors hover:bg-muted/50",
          isSelected && "bg-muted",
        )}
        initial={{ opacity: 0, y: -100 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.15, ease: "easeOut" }}
        layoutId={run.id}
        onClick={(event) => onRowClick(event, runPath)}
        onAuxClick={(event) => handleRowAuxClick(event, runPath)}
      >
        <TableCell>
          <div className="flex items-center">
            <Checkbox
              checked={isSelected}
              onCheckedChange={onSelectedChange}
              onClick={(e) => {
                e.stopPropagation()
              }}
              aria-label={`Select job ${run.jobId}`}
            />
          </div>
        </TableCell>
        <TableCell>
          <Link
            href={runPath}
            className="block rounded-sm font-mono text-xs underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <TruncatedTooltip value={run.jobId} />
          </Link>
        </TableCell>
        <TableCell>
          <TruncatedTooltip value={run.queue} />
        </TableCell>
        <TableCell>{run.tags && <RunTags tags={run.tags} onTagClick={onTagClick} />}</TableCell>
        <TableCell>
          <span className="flex items-center gap-1">
            <RunStatusBadge status={run.status} />
            {run.status === "active" && <StuckRunWarning stuckRun={stuckRun} />}
          </span>
        </TableCell>
        <TableCell>{getRunDuration(run) ?? "-"}</TableCell>
        <TableCell>
          <RunTimestamp value={run.createdAt} />
        </TableCell>
        <TableCell>{run.finishedAt ? <RunTimestamp value={run.finishedAt} /> : "-"}</TableCell>
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
          <div className="transition-opacity duration-200 focus-within:opacity-100 pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100">
            <RunActions jobId={run.jobId} queueName={run.queue} status={run.status} />
          </div>
        </TableCell>
      </m.tr>
    </AnimatePresence>
  )
}

const getSelectedCountLabel = (matchingTotal: number | undefined, selectedCount: number) => {
  if (matchingTotal !== undefined) return `${matchingTotal.toLocaleString()} selected`
  return selectedCount > 0 ? `${selectedCount} selected` : "Select all"
}

// Sorting by duration starts with the longest runs, then flips the direction
const getDurationSortUpdate = (filters: TRunFilters) => ({
  sortBy: "durationMs" as const,
  sortDirection:
    filters.sortBy === "durationMs" && filters.sortDirection === "desc"
      ? ("asc" as const)
      : ("desc" as const),
})

const getSelectionState = ({
  pageCount,
  selectedCount,
  selectAllMatching,
  hasOtherPages,
}: {
  pageCount: number
  selectedCount: number
  selectAllMatching: boolean
  hasOtherPages: boolean
}) => {
  const isPageSelected = pageCount > 0 && selectedCount === pageCount
  const isAllSelected = selectAllMatching || isPageSelected

  return {
    isAllSelected,
    isPartiallySelected: !isAllSelected && selectedCount > 0,
    // The whole page is selected and other pages exist: offer every run matching the filters
    showSelectionBanner: selectAllMatching || (isPageSelected && hasOtherPages),
  }
}

/** Runs picked by job ID on the page, or every run matching the filters */
const useRunSelection = () => {
  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set())
  const [selectAllMatching, setSelectAllMatching] = useState(false)

  const clearSelection = () => {
    setSelectedJobIds(new Set())
    setSelectAllMatching(false)
  }

  const setJobSelected = (jobId: string, checked: boolean) => {
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

  return {
    selectedJobIds,
    setSelectedJobIds,
    selectAllMatching,
    setSelectAllMatching,
    clearSelection,
    setJobSelected,
    isRunSelected: (jobId: string) => selectAllMatching || selectedJobIds.has(jobId),
  }
}

/** Rows open their run on click, in a new page with a modifier key, unless a control inside was used */
const useRunRowNavigation = () => {
  const router = useRouter()

  const handleRowClick = (event: React.MouseEvent<HTMLElement>, runPath: string) => {
    if (isInteractiveRowTarget(event.target)) return

    if (event.metaKey || event.ctrlKey) {
      openRunInNewPage(runPath)
      return
    }

    router.push(runPath)
  }

  const handleRowKeyDown = (event: React.KeyboardEvent<HTMLElement>, runPath: string) => {
    if (event.key === "Enter" && !isInteractiveRowTarget(event.target)) router.push(runPath)
  }

  return { handleRowClick, handleRowKeyDown }
}

export function RunsTable() {
  const { handleRowClick, handleRowKeyDown } = useRunRowNavigation()
  const queryClient = useQueryClient()
  const [liveUpdatesPaused, setLiveUpdatesPaused] = useState(false)
  const {
    selectedJobIds,
    setSelectedJobIds,
    selectAllMatching,
    setSelectAllMatching,
    clearSelection,
    setJobSelected: handleSelectJob,
    isRunSelected,
  } = useRunSelection()

  const {
    filters,
    queryFilters,
    setFilters: handleFiltersChange,
  } = useRunFilters({ onChange: clearSelection })
  const liveQueryKey = useMemo(() => ["jobs/table", queryFilters] as const, [queryFilters])

  const { data: runs, isPending: isPageLoading } = useQuery({
    queryKey: liveUpdatesPaused ? (["jobs/table-paused", queryFilters] as const) : liveQueryKey,
    queryFn: apiFetch({
      apiRoute: getJobsTableApiRoute,
      body: queryFilters,
    }),
    initialData: liveUpdatesPaused ? () => queryClient.getQueryData(liveQueryKey) : undefined,
    staleTime: liveUpdatesPaused ? Number.POSITIVE_INFINITY : undefined,
  })

  const jobs = useMemo(() => runs?.jobs ?? [], [runs])

  const handleTagClick = (tag: string) => {
    if (filters.tags.includes(tag)) return
    handleFiltersChange({ tags: [...filters.tags, tag] })
  }

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
  const stuckRunsById = useMemo(
    () => new Map(stuckRuns?.runs.map((run) => [run.id, run])),
    [stuckRuns],
  )

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

  const { isAllSelected, isPartiallySelected, showSelectionBanner } = getSelectionState({
    pageCount: jobs.length,
    selectedCount: selectedJobIds.size,
    selectAllMatching,
    hasOtherPages: Boolean(runs?.nextCursor || runs?.prevCursor || filters.cursor),
  })

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
    enabled: showSelectionBanner,
  })

  const matchingSelection =
    selectAllMatching && matchingCounts
      ? { filters: matchingFilters, counts: matchingCounts }
      : null

  const handleDurationSort = () => handleFiltersChange(getDurationSortUpdate(filters))

  return (
    <div className="space-y-4">
      <RunsFilters
        filters={filters}
        setFilters={handleFiltersChange}
        runs={runs}
        isPageLoading={isPageLoading}
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
      {showSelectionBanner && (
        <SelectionBanner
          matchingSelection={matchingSelection}
          pageCount={jobs.length}
          matchingTotal={matchingCounts?.total}
          onSelectAllMatching={() => setSelectAllMatching(true)}
          onClearSelection={clearSelection}
        />
      )}
      {/* Mobile: card list */}
      <div className="space-y-2 md:hidden">
        <div className="flex items-center justify-between gap-2 px-1">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Checkbox
              checked={isAllSelected}
              indeterminate={isPartiallySelected}
              onCheckedChange={handleSelectAll}
              aria-label="Select all jobs"
            />
            {getSelectedCountLabel(matchingSelection?.counts.total, selectedJobIds.size)}
          </label>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="flex items-center gap-1 px-2 text-sm font-medium text-muted-foreground"
              onClick={handleDurationSort}
            >
              Duration
              <DurationSortIcon filters={filters} />
            </button>
            <LiveUpdatesToggle paused={liveUpdatesPaused} onPausedChange={setLiveUpdatesPaused} />
          </div>
        </div>
        <div className="divide-y overflow-hidden rounded-lg border bg-card">
          {jobs.map((run) => {
            const runPath = `/runs/${run.id}`

            return (
              <RunListItem
                key={`${run.id}-${run.createdAt.getTime()}`}
                run={run}
                isSelected={isRunSelected(run.jobId)}
                stuckRun={stuckRunsById.get(run.id)}
                onSelectedChange={(checked) => handleSelectJob(run.jobId, checked)}
                onClick={(event) => handleRowClick(event, runPath)}
                onAuxClick={(event) => handleRowAuxClick(event, runPath)}
                onKeyDown={(event) => handleRowKeyDown(event, runPath)}
              />
            )
          })}
        </div>
        <RunsPagination
          runs={runs}
          filters={filters}
          setFilters={handleFiltersChange}
          isPageLoading={isPageLoading}
          className="pt-1"
        />
      </div>

      {/* Desktop: table */}
      <div className="hidden overflow-hidden rounded-lg border md:block">
        <ScrollArea>
          <Table className="w-full table-fixed">
            <TableHeader className="z-10">
              <TableRow>
                <TableHead className="w-12.5">
                  <div className="flex items-center">
                    <Checkbox
                      checked={isAllSelected}
                      indeterminate={isPartiallySelected}
                      onCheckedChange={handleSelectAll}
                      aria-label="Select all jobs"
                    />
                  </div>
                </TableHead>
                <TableHead className="w-30">Job ID</TableHead>
                <TableHead className="w-65">Queue</TableHead>
                <TableHead className="w-45">Tags</TableHead>
                <TableHead className="w-30">Status</TableHead>
                <TableHead className="w-30">
                  <button
                    type="button"
                    className="flex items-center gap-1 font-medium"
                    onClick={handleDurationSort}
                  >
                    Duration
                    <DurationSortIcon filters={filters} />
                  </button>
                </TableHead>
                <TableHead className="w-42.5">Created</TableHead>
                <TableHead className="w-42.5">Finished</TableHead>
                <TableHead className="w-60">Error</TableHead>
                <TableHead className="w-22.5">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((run) => (
                <RunTableRow
                  key={`${run.id}-${run.createdAt.getTime()}`}
                  run={run}
                  isSelected={isRunSelected(run.jobId)}
                  stuckRun={stuckRunsById.get(run.id)}
                  onSelectedChange={(checked) => handleSelectJob(run.jobId, checked)}
                  onRowClick={handleRowClick}
                  onTagClick={handleTagClick}
                />
              ))}
            </TableBody>
          </Table>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>
    </div>
  )
}
