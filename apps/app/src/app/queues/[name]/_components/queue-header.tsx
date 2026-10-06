"use client"

import { Badge } from "@better-bull-board/ui/components/badge"
import { Skeleton } from "@better-bull-board/ui/components/skeleton"
import { cn } from "cn"
import { formatDuration } from "date-fns"
import Link from "next/link"
import { useRouter } from "next/navigation"
import type { z } from "zod"
import type { queueDetailsOutput } from "~/app/api/queues/details/schemas"
import { QueueActions } from "~/app/queues/_components/queue-actions"
import { getRunsHref } from "~/lib/utils/runs-link"

type QueueDetails = z.output<typeof queueDetailsOutput>

interface QueueHeaderProps {
  queueName: string
  details: QueueDetails | undefined
  isLoading: boolean
}

const getSchedule = ({ patterns, everys }: QueueDetails) => {
  if (patterns.length) return patterns.join(", ")
  if (everys.length) return everys.map((every) => `Every ${formatDuration({ seconds: every / 1000 })}`).join(", ")
  return null
}

export function QueueHeader({ queueName, details, isLoading }: QueueHeaderProps) {
  const router = useRouter()
  const schedule = details ? getSchedule(details) : null

  const counts = [
    { label: "waiting", status: "waiting", value: details?.waitingJobs },
    { label: "active", status: "active", value: details?.activeJobs },
    { label: "delayed", status: "delayed", value: details?.delayedJobs },
  ]

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="truncate text-xl font-semibold" title={queueName}>
            {queueName}
          </h2>
          {isLoading ? (
            <Skeleton className="h-5 w-16" />
          ) : (
            details && (
              <Badge variant="outline" className={cn({ "opacity-50": details.isPaused })}>
                {details.isPaused ? "Paused" : "Running"}
              </Badge>
            )
          )}
        </div>
        {schedule && <p className="truncate font-mono text-sm text-muted-foreground">{schedule}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex h-8 items-center gap-3 rounded-lg border px-2.5 text-xs text-muted-foreground">
          {isLoading ? (
            <Skeleton className="h-4 w-40" />
          ) : (
            counts.map((count) => (
              <Link
                key={count.status}
                href={getRunsHref({ queue: queueName, status: count.status })}
                className="whitespace-nowrap rounded-sm underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <span className="font-mono text-foreground">{(count.value ?? 0).toLocaleString()}</span> {count.label}
              </Link>
            ))
          )}
        </div>
        {details && (
          <QueueActions queueName={details.name} isPaused={details.isPaused} onDeleted={() => router.push("/queues")} />
        )}
      </div>
    </div>
  )
}
