"use client"

import type { JobLogEntry } from "@better-bull-board/core/job-schemas"
import type { jobRunsTable } from "@better-bull-board/db"
import { DrawerTitle } from "@better-bull-board/ui/components/drawer"
import { Separator } from "@better-bull-board/ui/components/separator"
import { cn } from "cn"
import { AlertCircle, CalendarClock, ChevronRight, Clock } from "lucide-react"

import { smartFormatDuration } from "~/lib/utils/client"
import { formatUtcDateTime } from "~/lib/utils/date"

import { DetailsDrawerBody, DetailsDrawerHeader } from "./details-drawer"
import { LogLevelBadge, LogLevelIcon } from "./log-level"

interface LogDetailsDrawerProps {
  log: JobLogEntry
  run: typeof jobRunsTable.$inferSelect
  onBack: () => void
}

const formatRelativeTime = (ms: number): string => smartFormatDuration(Math.max(0, ms))

const DetailItem = ({
  icon,
  label,
  value,
  className,
}: {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
  className?: string
}) => (
  <div className={cn("flex items-center space-x-3", className)}>
    <div className="shrink-0">{icon}</div>
    <div className="min-w-0 flex-1">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  </div>
)

/** Also shown while the log loads or when it can't be found, so the way back to the run stays */
export function LogDetailsDrawerHeader({ level, onBack }: { level?: string; onBack: () => void }) {
  return (
    <DetailsDrawerHeader>
      {/* A breadcrumb like the page's: the run is where the log comes from */}
      <button
        type="button"
        className="rounded-sm text-base text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        onClick={onBack}
      >
        Run
      </button>
      <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <DrawerTitle className="flex-1">
        <span className="flex items-center gap-2">
          {level && <LogLevelIcon level={level} />}
          Log Details
        </span>
      </DrawerTitle>
    </DetailsDrawerHeader>
  )
}

export function LogDetailsDrawer({ log, run, onBack }: LogDetailsDrawerProps) {
  const logDate = new Date(log.ts)
  const scheduledTime = (run.enqueuedAt?.getTime() ?? run.createdAt.getTime()) + run.delayMs
  const baseTime = Math.max(run.createdAt.getTime(), scheduledTime)
  const relativeTime = Math.max(0, log.ts - baseTime)

  return (
    <>
      <LogDetailsDrawerHeader level={log.level} onBack={onBack} />
      <DetailsDrawerBody>
        <div className="space-y-6">
          {/* Log Level */}
          <div>
            <h3 className="mb-3 text-sm font-medium">Level</h3>
            <LogLevelBadge level={log.level} />
          </div>

          <Separator />

          {/* Basic Info */}
          <div>
            <h3 className="mb-3 text-sm font-medium">Basic Information</h3>
            <div className="space-y-3">
              <DetailItem
                icon={<CalendarClock className="h-4 w-4 text-muted-foreground" />}
                label="Timestamp"
                value={formatUtcDateTime(logDate, { milliseconds: true })}
              />
              <DetailItem
                icon={<Clock className="h-4 w-4 text-muted-foreground" />}
                label="Relative Time"
                value={`${formatRelativeTime(relativeTime)} after start`}
              />
              <DetailItem
                icon={<AlertCircle className="h-4 w-4 text-muted-foreground" />}
                label="Log ID"
                value={<span className="font-mono text-xs break-all">{log.id}</span>}
              />
            </div>
          </div>

          <Separator />

          {/* Message */}
          <div>
            <h3 className="mb-3 text-sm font-medium">Message</h3>
            <div className="rounded border bg-muted/30 p-2">
              <pre className="font-mono text-xs wrap-break-word whitespace-pre-wrap">
                {log.message}
              </pre>
            </div>
          </div>
        </div>
      </DetailsDrawerBody>
    </>
  )
}
