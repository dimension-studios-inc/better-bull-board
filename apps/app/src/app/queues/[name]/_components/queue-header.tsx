"use client"

import { Skeleton } from "@better-bull-board/ui/components/skeleton"
import Link from "next/link"
import type { z } from "zod"

import type { queueDetailsOutput } from "~/app/api/queues/details/schemas"
import { QueueStateBadge } from "~/app/queues/_components/queue-state-badge"
import { getRunsHref } from "~/lib/utils/runs-link"
import { describeSchedule } from "~/lib/utils/schedule"

type QueueDetails = z.output<typeof queueDetailsOutput>

interface QueueHeaderProps {
  queueName: string
  details: QueueDetails | undefined
  isLoading: boolean
}

const getSchedule = ({ patterns, everys }: QueueDetails) => {
  const schedules = [
    ...patterns.map((pattern) => describeSchedule({ pattern, every: null, tz: null })),
    ...everys.map((every) => describeSchedule({ pattern: null, every, tz: null })),
  ]
  return schedules.length ? schedules.join(", ") : null
}

export function QueueHeader({ queueName, details, isLoading }: QueueHeaderProps) {
  const schedule = details ? getSchedule(details) : null

  const counts = [
    { label: "waiting", status: "waiting", value: details?.waitingJobs },
    { label: "active", status: "active", value: details?.activeJobs },
    { label: "delayed", status: "delayed", value: details?.delayedJobs },
  ]

  return (
    <div className="min-w-0 space-y-1">
      <div className="flex min-w-0 items-start gap-2 sm:items-center">
        {/* Long queue names wrap on phones rather than hiding the part that tells them apart */}
        <h2 className="min-w-0 text-xl font-semibold wrap-break-word sm:truncate" title={queueName}>
          {queueName}
        </h2>
        {isLoading ? (
          <Skeleton className="mt-1 h-5 w-16 shrink-0 sm:mt-0" />
        ) : (
          details && (
            <QueueStateBadge isPaused={details.isPaused} className="mt-1 shrink-0 sm:mt-0" />
          )
        )}
      </div>
      {schedule && <p className="truncate text-sm text-muted-foreground">{schedule}</p>}
      {/* What the queue holds right now, apart from the period controls below */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
        {isLoading ? (
          <Skeleton className="h-5 w-48" />
        ) : (
          counts.map((count) => (
            <Link
              key={count.status}
              href={getRunsHref({ queue: queueName, status: count.status })}
              className="rounded-sm whitespace-nowrap underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <span className="font-medium text-foreground tabular-nums">
                {(count.value ?? 0).toLocaleString()}
              </span>{" "}
              {count.label}
            </Link>
          ))
        )}
      </div>
    </div>
  )
}
