"use client"

import { Checkbox } from "@better-bull-board/ui/components/checkbox"
import { cn } from "cn"
import { formatDistanceToNowStrict } from "date-fns"
import type { output } from "zod"
import type { getJobsTableApiRoute } from "~/app/api/jobs/table/schemas"
import { RunStatusBadge } from "~/components/run-status-badge"
import { formatUtcDateTime } from "~/lib/utils/date"
import type { StuckRun } from "~/lib/utils/stuck-runs"
import { RunActions } from "./run-actions"
import { getRunDuration, StuckRunWarning } from "./run-display"

type Run = output<typeof getJobsTableApiRoute.outputSchema>["jobs"][number]

type RunListItemProps = {
  run: Run
  isSelected: boolean
  stuckRun: StuckRun | undefined
  onSelectedChange: (checked: boolean) => void
  onClick: React.MouseEventHandler<HTMLElement>
  onAuxClick: React.MouseEventHandler<HTMLElement>
  onKeyDown: React.KeyboardEventHandler<HTMLElement>
}

/** A run of the runs list on phones: three dense lines instead of the table */
export function RunListItem({
  run,
  isSelected,
  stuckRun,
  onSelectedChange,
  onClick,
  onAuxClick,
  onKeyDown,
}: RunListItemProps) {
  const duration = getRunDuration(run)
  const [firstTag, ...otherTags] = run.tags ?? []

  return (
    // biome-ignore lint/a11y/useSemanticElements: row contains nested interactive controls
    <div
      role="link"
      tabIndex={0}
      className={cn(
        "flex cursor-pointer gap-3 px-3 py-2.5 transition-colors active:bg-muted/50",
        isSelected && "bg-muted",
      )}
      onClick={onClick}
      onAuxClick={onAuxClick}
      onKeyDown={onKeyDown}
    >
      <Checkbox
        className="mt-0.5"
        checked={isSelected}
        onCheckedChange={onSelectedChange}
        onClick={(e) => {
          e.stopPropagation()
        }}
        aria-label={`Select job ${run.jobId}`}
      />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium">{run.queue}</span>
          <span className="flex shrink-0 items-center gap-1">
            {run.status === "active" && <StuckRunWarning stuckRun={stuckRun} />}
            <RunStatusBadge status={run.status} />
          </span>
        </div>
        <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <span className="shrink-0 font-mono">#{run.jobId}</span>
          {firstTag && (
            <>
              <span aria-hidden>·</span>
              <span className="truncate">{firstTag}</span>
              {otherTags.length > 0 && <span className="shrink-0">+{otherTags.length}</span>}
            </>
          )}
        </div>
        {run.status === "failed" && run.errorMessage && (
          <p className="line-clamp-2 break-all rounded bg-destructive/10 px-2 py-1 font-mono text-xs text-destructive">
            {run.errorMessage}
          </p>
        )}
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 truncate text-xs text-muted-foreground">
            <time dateTime={run.createdAt.toISOString()} title={formatUtcDateTime(run.createdAt)}>
              {formatDistanceToNowStrict(run.createdAt, { addSuffix: true })}
            </time>
            {duration && <> · {duration}</>}
          </div>
          <div className="-my-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
            <RunActions jobId={run.jobId} queueName={run.queue} status={run.status} />
          </div>
        </div>
      </div>
    </div>
  )
}
