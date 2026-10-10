"use client"

import type { jobRunsTable } from "@better-bull-board/db"
import { Alert, AlertDescription } from "@better-bull-board/ui/components/alert"
import { ScrollArea } from "@better-bull-board/ui/components/scroll-area"
import { Skeleton } from "@better-bull-board/ui/components/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@better-bull-board/ui/components/tooltip"
import { cn } from "cn"
import { AlertCircle } from "lucide-react"

import { Loader } from "~/components/loader"
import { useInfiniteScroll } from "~/hooks/use-infinite-scroll"
import { smartFormatDuration } from "~/lib/utils/client"

import { LogLevelIcon } from "./log-level"

interface LogEntry {
  id: string
  jobRunId: string
  level: string
  message: string
  ts: number
}

interface LogsWaterfallProps {
  logs: LogEntry[]
  isLoading: boolean
  error: Error | null
  run: typeof jobRunsTable.$inferSelect
  /** When the data was last fetched, which ends the timeline of a run still in progress */
  now: number
  onLogClick: (log: LogEntry) => void
  hasMore: boolean
  onLoadMore: () => void
}

const getWaterfallColor = (level: string) => {
  switch (level.toLowerCase()) {
    case "error":
      return "bg-destructive"
    case "warn":
    case "warning":
      return "bg-warning"
    case "debug":
      return "bg-highlight"
    case "info":
      return "bg-info"
    default:
      return "bg-muted-foreground"
  }
}

export function LogsWaterfall({
  logs,
  isLoading,
  error,
  run,
  now,
  onLogClick,
  hasMore,
  onLoadMore,
}: LogsWaterfallProps) {
  const { loaderRef: logsLoaderRef } = useInfiniteScroll({
    fetchNextPage: onLoadMore,
    hasNextPage: hasMore,
    isFetchingNextPage: isLoading,
  })

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load logs. There was an error retrieving the log data.
        </AlertDescription>
      </Alert>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          // oxlint-disable-next-line react/no-array-index-key -- static skeleton placeholders never reorder
          <div key={i} className="flex items-start space-x-3">
            <Skeleton className="h-4 w-4" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-full" />
            </div>
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    )
  }

  if (!logs || logs.length === 0) {
    return <div className="py-8 text-center text-muted-foreground">No logs found for this run</div>
  }

  // Sort logs by timestamp ascending to show chronological order
  const sortedLogs = logs.toSorted((a, b) => a.ts - b.ts)

  const scheduledTime = (run.enqueuedAt?.getTime() ?? run.createdAt.getTime()) + run.delayMs
  const startTime = Math.max(run.createdAt.getTime(), scheduledTime)
  const endTime = run.finishedAt ? run.finishedAt.getTime() : now
  const totalDuration = endTime - startTime

  return (
    <ScrollArea className="h-(--run-panel-height) lg:h-(--run-panel-height-lg)">
      <div className="pr-4">
        {/* Waterfall header with time markers */}
        <div className="mb-4 grid grid-cols-12 gap-4 border-b pb-2">
          <div className="col-span-7 md:col-span-6">
            <span className="text-sm font-medium text-muted-foreground">Log Details</span>
          </div>
          <div className="col-span-5 md:col-span-6">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0ms</span>
              <span className="hidden sm:inline">Timeline</span>
              <span>{smartFormatDuration(totalDuration)}</span>
            </div>
          </div>
        </div>

        <div className="">
          {sortedLogs.map((log) => {
            const relativeTime = log.ts - startTime
            const position = totalDuration > 0 ? (relativeTime / totalDuration) * 100 : 0

            return (
              <div
                key={log.id}
                className={cn(
                  "grid grid-cols-12 items-start",
                  "hover:bg-muted/50",
                  "cursor-pointer",
                  {
                    "hover:bg-destructive/5": log.level.toLowerCase() === "error",
                    "hover:bg-warning/5": log.level.toLowerCase() === "warn",
                  },
                )}
                // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- the row holds block content and a tooltip trigger button, which a <button> cannot contain
                role="button"
                tabIndex={0}
                onClick={() => onLogClick(log)}
                onKeyDown={(event) => {
                  if (event.target !== event.currentTarget) return
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault()
                    onLogClick(log)
                  }
                }}
              >
                <div
                  className={cn(
                    "col-span-7 flex items-center space-x-3 rounded p-2 font-mono md:col-span-6",
                  )}
                >
                  {/* Timeline dot */}
                  <Tooltip>
                    <TooltipTrigger>
                      <div className="shrink-0">
                        <LogLevelIcon level={log.level} />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>{log.level.toUpperCase()}</TooltipContent>
                  </Tooltip>

                  {/* Log content */}
                  <div className="min-w-0 flex-1">
                    <pre className="truncate text-xs">{log.message}</pre>
                  </div>
                </div>
                <div className="col-span-5 flex h-full items-center border-l border-muted-foreground/20 md:col-span-6">
                  <div className="flex size-full items-center">
                    {/* Waterfall bar */}
                    <div
                      className={cn(
                        "ml-(--bar-offset) flex h-3 w-2 shrink-0 items-center justify-center rounded-sm",
                        getWaterfallColor(log.level),
                      )}
                      style={{ "--bar-offset": `${position}%` } as React.CSSProperties}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        {hasMore && (
          <div className="flex items-center justify-center" ref={logsLoaderRef}>
            <Loader />
          </div>
        )}
      </div>
    </ScrollArea>
  )
}
