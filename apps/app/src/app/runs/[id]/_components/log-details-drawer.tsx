"use client"

import type { jobRunsTable } from "@better-bull-board/db"
import { Button } from "@better-bull-board/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@better-bull-board/ui/components/card"
import { ScrollArea } from "@better-bull-board/ui/components/scroll-area"
import { Separator } from "@better-bull-board/ui/components/separator"
import { cn } from "cn"
import { AlertCircle, ArrowLeft, CalendarClock, Clock } from "lucide-react"

import { smartFormatDuration } from "~/lib/utils/client"
import { formatUtcDateTime } from "~/lib/utils/date"

import { LogLevelBadge, LogLevelIcon } from "./log-level"

interface LogEntry {
  id: string
  jobRunId: string
  level: string
  message: string
  ts: number
}

interface LogDetailsDrawerProps {
  log: LogEntry
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

export function LogDetailsDrawer({ log, run, onBack }: LogDetailsDrawerProps) {
  const logDate = new Date(log.ts)
  const scheduledTime = (run.enqueuedAt?.getTime() ?? run.createdAt.getTime()) + run.delayMs
  const baseTime = Math.max(run.createdAt.getTime(), scheduledTime)
  const relativeTime = Math.max(0, log.ts - baseTime)

  return (
    <Card className="overflow-hidden lg:h-[calc(100vh-12rem)]">
      <CardHeader>
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back to the run">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <CardTitle className="flex items-center space-x-2">
            <LogLevelIcon level={log.level} />
            <span>Log Details</span>
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="overflow-hidden pb-6 lg:h-full">
        <ScrollArea className="lg:h-full [&>[data-slot=scroll-area-viewport]>div]:block!">
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
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
