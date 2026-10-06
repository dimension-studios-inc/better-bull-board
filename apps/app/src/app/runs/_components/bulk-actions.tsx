"use client"

import { cancellableJobStatuses, replayableJobStatuses } from "@better-bull-board/core/job-schemas"
import { BULK_JOB_ACTION_LIMIT, type bulkMutationResultSchema } from "@better-bull-board/core/mutation-schemas"
import { Alert, AlertDescription } from "@better-bull-board/ui/components/alert"
import { Badge } from "@better-bull-board/ui/components/badge"
import { Button } from "@better-bull-board/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@better-bull-board/ui/components/dialog"
import { ScrollArea } from "@better-bull-board/ui/components/scroll-area"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, RotateCcw, Trash2, X } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import type { z } from "zod"
import { bulkCancelJobsApiRoute } from "~/app/api/jobs/bulk-cancel/schemas"
import { bulkCancelJobsByFiltersApiRoute } from "~/app/api/jobs/bulk-cancel-by-filters/schemas"
import { bulkReplayJobsApiRoute } from "~/app/api/jobs/bulk-replay/schemas"
import { bulkReplayJobsByFiltersApiRoute } from "~/app/api/jobs/bulk-replay-by-filters/schemas"
import { apiFetch } from "~/lib/utils/client"
import { formatCreatedFilterLabel } from "./runs-filters"
import type { TRunFilters } from "./types"

export type TMatchingFilters = Pick<TRunFilters, "queue" | "status" | "search" | "tags" | "createdFrom" | "createdTo">

type TMatchingSelection = {
  filters: TMatchingFilters
  counts: { total: number; replayable: number; cancellable: number }
}

type TBulkMutationResult = z.output<typeof bulkMutationResultSchema>

interface BulkActionsProps {
  selectedJobs: Array<{
    jobId: string
    queue: string
    status: string
  }>
  // Set when every run matching the filters is selected: actions then run server side on the filters
  matchingSelection: TMatchingSelection | null
  onClearSelection: () => void
}

export const formatRunCount = (count: number) => `${count.toLocaleString()} run${count === 1 ? "" : "s"}`

const isOneOf = <T extends string>(values: readonly T[], value: string): value is T => values.includes(value as T)

const showBulkResultToast = (action: "Replayed" | "Cancelled", result: TBulkMutationResult) => {
  const details = [
    result.skipped > 0 &&
      `${formatRunCount(result.skipped)} skipped: their job was already handled or has run again since.`,
    result.failed > 0 && `${formatRunCount(result.failed)} failed.`,
    result.limitReached &&
      `Stopped at the ${formatRunCount(BULK_JOB_ACTION_LIMIT)} limit: narrow the filters to handle the rest.`,
  ].filter(Boolean)
  const showToast = result.failed > 0 || result.limitReached ? toast.warning : toast.success

  showToast(`${action} ${formatRunCount(result.succeeded)}`, {
    description: details.length > 0 ? details.join(" ") : undefined,
  })
}

function MatchingFiltersSummary({ filters }: { filters: TMatchingFilters }) {
  const items = [
    filters.queue !== "all" && { label: "Queue", value: filters.queue },
    filters.status !== "all" && { label: "Status", value: filters.status },
    filters.search && { label: "Search", value: `"${filters.search}"` },
    filters.tags.length > 0 && { label: "Tags", value: filters.tags.join(", ") },
    filters.createdFrom && { label: "Created from", value: formatCreatedFilterLabel(filters.createdFrom) },
    filters.createdTo && { label: "Created to", value: formatCreatedFilterLabel(filters.createdTo) },
  ].filter((item): item is { label: string; value: string } => !!item)

  if (items.length === 0) {
    return (
      <Alert variant="destructive">
        <AlertTriangle />
        <AlertDescription>No filters are applied: this targets every run.</AlertDescription>
      </Alert>
    )
  }

  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 rounded-lg bg-muted/50 p-3 text-sm">
      {items.map((item) => (
        <div key={item.label} className="contents">
          <dt className="text-muted-foreground">{item.label}</dt>
          <dd className="truncate font-medium" title={item.value}>
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

function MatchingSelectionDetails({
  matchingSelection,
  eligibleCount,
  verb,
}: {
  matchingSelection: TMatchingSelection
  eligibleCount: number
  verb: "replayed" | "cancelled"
}) {
  return (
    <div className="space-y-3">
      <MatchingFiltersSummary filters={matchingSelection.filters} />
      {eligibleCount > BULK_JOB_ACTION_LIMIT && (
        <Alert>
          <AlertTriangle />
          <AlertDescription>
            Only the {formatRunCount(BULK_JOB_ACTION_LIMIT)} created most recently will be {verb}. Narrow the filters
            (for example the created range) to handle the rest.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}

export function BulkActions({ selectedJobs, matchingSelection, onClearSelection }: BulkActionsProps) {
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [replayDialogOpen, setReplayDialogOpen] = useState(false)
  const queryClient = useQueryClient()

  const invalidateRuns = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["jobs/table"] }),
      queryClient.invalidateQueries({ queryKey: ["jobs/count"] }),
    ])

  const bulkCancelMutation = useMutation({
    mutationFn: apiFetch({
      apiRoute: bulkCancelJobsApiRoute,
      body: {
        jobs: selectedJobs.map((job) => ({
          jobId: job.jobId,
          queueName: job.queue,
        })),
      },
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["jobs/table"] })
      setCancelDialogOpen(false)
      onClearSelection()
    },
  })

  const bulkReplayMutation = useMutation({
    mutationFn: apiFetch({
      apiRoute: bulkReplayJobsApiRoute,
      body: {
        jobs: selectedJobs.map((job) => ({
          jobId: job.jobId,
          queueName: job.queue,
        })),
      },
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["jobs/table"] })
      setReplayDialogOpen(false)
      onClearSelection()
    },
  })

  const matchingCancelMutation = useMutation({
    mutationFn: (filters: TMatchingFilters) =>
      apiFetch({ apiRoute: bulkCancelJobsByFiltersApiRoute, body: { filters } })(),
    onSuccess: async (result) => {
      showBulkResultToast("Cancelled", result)
      await invalidateRuns()
      setCancelDialogOpen(false)
      onClearSelection()
    },
  })

  const matchingReplayMutation = useMutation({
    mutationFn: (filters: TMatchingFilters) =>
      apiFetch({ apiRoute: bulkReplayJobsByFiltersApiRoute, body: { filters } })(),
    onSuccess: async (result) => {
      showBulkResultToast("Replayed", result)
      await invalidateRuns()
      setReplayDialogOpen(false)
      onClearSelection()
    },
  })

  const handleBulkCancel = () => {
    if (matchingSelection) {
      matchingCancelMutation.mutate(matchingSelection.filters)
    } else {
      bulkCancelMutation.mutate()
    }
  }

  const handleBulkReplay = () => {
    if (matchingSelection) {
      matchingReplayMutation.mutate(matchingSelection.filters)
    } else {
      bulkReplayMutation.mutate()
    }
  }

  const cancellableJobs = selectedJobs.filter((job) => isOneOf(cancellableJobStatuses, job.status))
  const replayableJobs = selectedJobs.filter((job) => isOneOf(replayableJobStatuses, job.status))
  const cancellableCount = matchingSelection ? matchingSelection.counts.cancellable : cancellableJobs.length
  const replayableCount = matchingSelection ? matchingSelection.counts.replayable : replayableJobs.length
  const isCancelPending = bulkCancelMutation.isPending || matchingCancelMutation.isPending
  const isReplayPending = bulkReplayMutation.isPending || matchingReplayMutation.isPending

  if (selectedJobs.length === 0 && !matchingSelection) {
    return null
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {cancellableCount > 0 && (
          <Button variant="destructive" onClick={() => setCancelDialogOpen(true)} className="flex items-center gap-2">
            <X className="size-4" />
            Cancel ({cancellableCount.toLocaleString()})
          </Button>
        )}

        {replayableCount > 0 && (
          <Button variant="default" onClick={() => setReplayDialogOpen(true)} className="flex items-center gap-2">
            <RotateCcw className="size-4" />
            Replay ({replayableCount.toLocaleString()})
          </Button>
        )}

        <Button variant="outline" onClick={onClearSelection}>
          <Trash2 className="size-4" />
          <span className="hidden sm:inline">Clear Selection</span>
          <span className="sm:hidden">Clear</span>
        </Button>
      </div>

      {/* Cancel Confirmation Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Cancel Jobs</DialogTitle>
            <DialogDescription>
              {matchingSelection ? (
                <>
                  Are you sure you want to cancel {formatRunCount(cancellableCount)} out of the{" "}
                  {formatRunCount(matchingSelection.counts.total)} matching these filters? Only active, waiting and
                  delayed runs can be cancelled. This action cannot be undone.
                </>
              ) : (
                <>
                  Are you sure you want to cancel {cancellableCount} job
                  {cancellableCount === 1 ? "" : "s"}? This action cannot be undone.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {matchingSelection ? (
            <MatchingSelectionDetails
              matchingSelection={matchingSelection}
              eligibleCount={cancellableCount}
              verb="cancelled"
            />
          ) : (
            <ScrollArea className="[&>[data-slot=scroll-area-viewport]]:max-h-60">
              <div className="space-y-2">
                {cancellableJobs.map((job) => (
                  <div key={job.jobId} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded">
                    <Badge variant="outline">{job.queue}</Badge>
                    <span className="font-mono text-xs">{job.jobId.slice(0, 20)}...</span>
                    <Badge className="ml-auto">{job.status}</Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleBulkCancel} disabled={isCancelPending}>
              {isCancelPending ? "Cancelling..." : "Cancel Jobs"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Replay Confirmation Dialog */}
      <Dialog open={replayDialogOpen} onOpenChange={setReplayDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Replay Jobs</DialogTitle>
            <DialogDescription>
              {matchingSelection ? (
                <>
                  Are you sure you want to replay {formatRunCount(replayableCount)} out of the{" "}
                  {formatRunCount(matchingSelection.counts.total)} matching these filters? Only completed and failed
                  runs can be replayed, with the same data and configuration.
                </>
              ) : (
                <>
                  Are you sure you want to replay {replayableCount} job
                  {replayableCount === 1 ? "" : "s"}? This will create new job instances with the same data and
                  configuration.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {matchingSelection ? (
            <MatchingSelectionDetails
              matchingSelection={matchingSelection}
              eligibleCount={replayableCount}
              verb="replayed"
            />
          ) : (
            <ScrollArea className="[&>[data-slot=scroll-area-viewport]]:max-h-60">
              <div className="space-y-2">
                {replayableJobs.map((job) => (
                  <div key={job.jobId} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded">
                    <Badge variant="outline">{job.queue}</Badge>
                    <span className="font-mono text-xs">{job.jobId.slice(0, 20)}...</span>
                    <Badge className="ml-auto">{job.status}</Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReplayDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleBulkReplay} disabled={isReplayPending}>
              {isReplayPending ? "Replaying..." : "Replay Jobs"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
