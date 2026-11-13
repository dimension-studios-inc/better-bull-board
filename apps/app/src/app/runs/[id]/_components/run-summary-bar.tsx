"use client"

import type { jobRunsTable } from "@better-bull-board/db"
import { Button } from "@better-bull-board/ui/components/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@better-bull-board/ui/components/tooltip"
import { cn } from "cn"
import { PanelRightClose, PanelRightOpen } from "lucide-react"

import { getRunDuration } from "~/app/runs/_components/run-format"
import { RunStatusBadge } from "~/components/run-status-badge"

interface RunSummaryBarProps {
  run: typeof jobRunsTable.$inferSelect
  /** The details panel shows the run itself, not one of its logs */
  isRunShown: boolean
  isDetailsOpen: boolean
  onRunClick: () => void
  onToggleDetails: () => void
  className?: string
}

/** Keeps the run in view when the details are closed, and opens them like a log row does */
export function RunSummaryBar({
  run,
  isRunShown,
  isDetailsOpen,
  onRunClick,
  onToggleDetails,
  className,
}: RunSummaryBarProps) {
  const duration = getRunDuration(run)
  const toggleLabel = isDetailsOpen ? "Hide details" : "Show details"

  return (
    <div
      className={cn(
        "flex h-10 items-center gap-1 rounded-lg border pr-1.5 transition-colors hover:bg-muted/50",
        isRunShown && "bg-muted",
        className,
      )}
    >
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-3 self-stretch rounded-lg pl-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        aria-pressed={isRunShown}
        onClick={onRunClick}
      >
        {/* The name gives way to the details only past half of the bar */}
        <span className="max-w-1/2 shrink-0 truncate text-sm font-medium">
          {run.name ?? run.jobId}
        </span>
        <RunStatusBadge status={run.status} className="shrink-0" />
        <span className="flex min-w-0 items-center gap-3 overflow-hidden text-xs whitespace-nowrap text-muted-foreground">
          {run.name && <span className="font-mono">{run.jobId}</span>}
          <span>{run.queue}</span>
          {duration && <span>{duration}</span>}
          {run.maxAttempts !== 0 && (
            <span>
              Attempt {run.attempt} / {run.maxAttempts}
            </span>
          )}
        </span>
      </button>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={toggleLabel}
              aria-expanded={isDetailsOpen}
              onClick={onToggleDetails}
            />
          }
        >
          {isDetailsOpen ? <PanelRightClose /> : <PanelRightOpen />}
        </TooltipTrigger>
        <TooltipContent>{toggleLabel}</TooltipContent>
      </Tooltip>
    </div>
  )
}
