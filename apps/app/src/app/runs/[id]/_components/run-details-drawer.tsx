"use client"

import type { jobRunsTable } from "@better-bull-board/db"
import { Badge } from "@better-bull-board/ui/components/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@better-bull-board/ui/components/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@better-bull-board/ui/components/collapsible"
import { ScrollArea, ScrollBar } from "@better-bull-board/ui/components/scroll-area"
import { Separator } from "@better-bull-board/ui/components/separator"
import { cn } from "cn"
import {
  CalendarClock,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  Database,
  Hash,
  PlayCircle,
  Settings,
  Tag,
  User,
} from "lucide-react"
import { useEffect, useState } from "react"
import { codeToHtml } from "shiki"

import { RunStatusBadge, RunStatusIcon } from "~/components/run-status-badge"
import { smartFormatDuration } from "~/lib/utils/client"
import { formatUtcDateTime } from "~/lib/utils/date"

interface RunDetailsDrawerProps {
  run: typeof jobRunsTable.$inferSelect
}

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

const JsonCollapsible = ({
  title,
  data,
  icon,
}: {
  title: string
  data: unknown
  icon: React.ReactNode
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [formattedData, setFormattedData] = useState<string>("")

  useEffect(() => {
    const formatMessage = async () => {
      try {
        const html = await codeToHtml(JSON.stringify(data, null, 2), {
          lang: "json",
          themes: { light: "vitesse-light", dark: "vitesse-dark" },
          defaultColor: false,
        })
        setFormattedData(html)
      } catch (error) {
        console.error("Failed to format message:", error)
        setFormattedData(JSON.stringify(data, null, 2))
      }
    }

    void formatMessage()
  }, [data])

  if (!data) return null

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex w-full items-center space-x-2 rounded p-2 text-left hover:bg-muted/50">
        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        {icon}
        <span className="text-sm font-medium">{title}</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2">
        <ScrollArea className="rounded border">
          <div
            className="p-3 text-xs"
            // Shiki generates safe HTML
            dangerouslySetInnerHTML={{ __html: formattedData }}
          />
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </CollapsibleContent>
    </Collapsible>
  )
}

export function RunDetailsDrawer({ run }: RunDetailsDrawerProps) {
  const duration =
    run.startedAt && run.finishedAt && (run.status === "completed" || run.status === "failed")
      ? smartFormatDuration(run.finishedAt.getTime() - run.startedAt.getTime())
      : null

  return (
    <Card className="lg:h-[calc(100vh-12rem)]">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <RunStatusIcon status={run.status} className="size-4" />
          <span>Run Details</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="overflow-hidden pb-6 lg:h-full">
        <ScrollArea className="lg:h-full [&>[data-slot=scroll-area-viewport]>div]:block!">
          <div className="space-y-6">
            {/* Status */}
            <div>
              <h3 className="mb-3 text-sm font-medium">Status</h3>
              <RunStatusBadge status={run.status} />
            </div>

            <Separator />

            {/* Basic Info */}
            <div>
              <h3 className="mb-3 text-sm font-medium">Basic Information</h3>
              <div className="space-y-3">
                <DetailItem
                  icon={<Hash className="h-4 w-4 text-muted-foreground" />}
                  label="Job ID"
                  value={<span className="font-mono text-xs break-all">{run.jobId}</span>}
                />
                <DetailItem
                  icon={<Database className="h-4 w-4 text-muted-foreground" />}
                  label="Queue"
                  value={run.queue}
                />
                {run.name && (
                  <DetailItem
                    icon={<Tag className="h-4 w-4 text-muted-foreground" />}
                    label="Name"
                    value={run.name}
                  />
                )}
                {run.workerId && (
                  <DetailItem
                    icon={<User className="h-4 w-4 text-muted-foreground" />}
                    label="Worker ID"
                    value={<span className="font-mono text-xs">{run.workerId}</span>}
                  />
                )}
              </div>
            </div>

            <Separator />

            {/* Timing */}
            <div>
              <h3 className="mb-3 text-sm font-medium">Timing</h3>
              <div className="space-y-3">
                <DetailItem
                  icon={<CalendarClock className="h-4 w-4 text-muted-foreground" />}
                  label="Created"
                  value={formatUtcDateTime(run.createdAt)}
                />
                {run.enqueuedAt && (
                  <DetailItem
                    icon={<PlayCircle className="h-4 w-4 text-muted-foreground" />}
                    label="Enqueued"
                    value={formatUtcDateTime(run.enqueuedAt)}
                  />
                )}
                {run.startedAt && (
                  <DetailItem
                    icon={<PlayCircle className="h-4 w-4 text-muted-foreground" />}
                    label="Started"
                    value={formatUtcDateTime(run.startedAt)}
                  />
                )}
                {run.finishedAt && (
                  <DetailItem
                    icon={<CheckCircle className="h-4 w-4 text-muted-foreground" />}
                    label="Finished"
                    value={formatUtcDateTime(run.finishedAt)}
                  />
                )}
                {duration && (
                  <DetailItem
                    icon={<Clock className="h-4 w-4 text-muted-foreground" />}
                    label="Duration"
                    value={duration}
                  />
                )}
              </div>
            </div>

            {/* Execution Details */}
            {(run.maxAttempts !== 0 || run.priority !== null || run.delayMs > 0) && (
              <>
                <Separator />
                <div>
                  <h3 className="mb-3 text-sm font-medium">Execution</h3>
                  <div className="space-y-3">
                    {run.maxAttempts !== 0 && (
                      <DetailItem
                        icon={<Settings className="h-4 w-4 text-muted-foreground" />}
                        label="Attempt"
                        value={`${run.attempt} / ${run.maxAttempts}`}
                      />
                    )}
                    {run.priority !== null && (
                      <DetailItem
                        icon={<Settings className="h-4 w-4 text-muted-foreground" />}
                        label="Priority"
                        value={run.priority}
                      />
                    )}
                    {run.delayMs > 0 && (
                      <DetailItem
                        icon={<Clock className="h-4 w-4 text-muted-foreground" />}
                        label="Delay"
                        value={smartFormatDuration(run.delayMs)}
                      />
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Tags */}
            {run.tags && run.tags.length > 0 && (
              <>
                <Separator />
                <div>
                  <h3 className="mb-3 text-sm font-medium">Tags</h3>
                  <div className="flex flex-wrap gap-1">
                    {run.tags.map((tag) => (
                      <Badge key={tag} variant="outline">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Error Details */}
            {run.status === "failed" && (run.errorMessage || run.errorStack) && (
              <>
                <Separator />
                <div>
                  <h3 className="mb-3 text-sm font-medium text-destructive">Error Details</h3>
                  {run.errorMessage && (
                    <div className="mb-3">
                      <div className="mb-1 text-xs text-muted-foreground">Message</div>
                      <div className="rounded border border-destructive/20 bg-destructive/5 p-2 text-sm dark:bg-destructive/10">
                        {run.errorMessage}
                      </div>
                    </div>
                  )}
                  {run.errorStack && (
                    <div>
                      <div className="mb-1 text-xs text-muted-foreground">Stack Trace</div>
                      <ScrollArea className="rounded border border-destructive/20 bg-destructive/5 p-2 font-mono text-xs dark:bg-destructive/10 [&>[data-slot=scroll-area-viewport]]:max-h-32">
                        <pre className="wrap-break-word whitespace-pre-wrap">{run.errorStack}</pre>
                      </ScrollArea>
                    </div>
                  )}
                </div>
              </>
            )}

            <Separator />

            {/* Data & Result */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Payloads</h3>
              <JsonCollapsible
                title="Input Data"
                data={run.data}
                icon={<Database className="h-4 w-4 text-muted-foreground" />}
              />
              <JsonCollapsible
                title="Result"
                data={run.result}
                icon={<CheckCircle className="h-4 w-4 text-muted-foreground" />}
              />
              <JsonCollapsible
                title="Backoff Config"
                data={run.backoff}
                icon={<Settings className="h-4 w-4 text-muted-foreground" />}
              />
            </div>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
