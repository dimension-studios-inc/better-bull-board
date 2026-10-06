"use client"

import { Alert, AlertDescription, AlertTitle } from "@better-bull-board/ui/components/alert"
import { useQuery } from "@tanstack/react-query"
import { AlertTriangle } from "lucide-react"
import Link from "next/link"
import { getStuckRunsApiRoute } from "~/app/api/jobs/stuck/schemas"
import { RunActions } from "~/app/runs/_components/run-actions"
import { apiFetch } from "~/lib/utils/client"
import { getRunsHref } from "~/lib/utils/runs-link"
import {
  describeStuckRun,
  formatShortDuration,
  formatUsualDuration,
  STUCK_RUNS_REFETCH_INTERVAL_MS,
} from "~/lib/utils/stuck-runs"

const VISIBLE_STUCK_RUNS = 5

/** Active runs taking far longer than their queue usually does, often a dead or hung worker */
export function StuckRunsAlert() {
  const { data } = useQuery({
    queryKey: ["jobs/stuck", { limit: VISIBLE_STUCK_RUNS }],
    queryFn: apiFetch({
      apiRoute: getStuckRunsApiRoute,
      body: { limit: VISIBLE_STUCK_RUNS },
    }),
    refetchInterval: STUCK_RUNS_REFETCH_INTERVAL_MS,
  })

  if (!data || data.total === 0) return null

  const hiddenCount = data.total - data.runs.length

  return (
    <Alert className="border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-200">
      <AlertTriangle />
      <AlertTitle>
        {data.total === 1 ? "1 run looks stuck" : `${data.total.toLocaleString()} runs look stuck`}
      </AlertTitle>
      <AlertDescription className="text-amber-900/80 dark:text-amber-200/80">
        <p className="mb-1">
          Active for far longer than their queue usually takes: check that their workers are alive.
        </p>
        <ul className="divide-y divide-amber-200 dark:divide-amber-900/50">
          {data.runs.map((run) => (
            <li key={run.id} className="flex items-center gap-2 py-1">
              <Link
                href={`/runs/${run.id}`}
                title={describeStuckRun(run)}
                className="group/run flex min-w-0 flex-1 flex-col gap-x-2 no-underline! sm:flex-row sm:items-baseline"
              >
                <span className="flex min-w-0 items-baseline gap-2">
                  <span className="truncate font-medium text-amber-950 underline-offset-3 group-hover/run:underline dark:text-amber-100">
                    {run.queue}
                  </span>
                  <span className="shrink-0 font-mono text-xs">#{run.jobId}</span>
                </span>
                <span className="shrink-0 text-xs sm:ml-auto">
                  running for <span className="font-medium">{formatShortDuration(run.runningForMs)}</span>,{" "}
                  {formatUsualDuration(run)}
                </span>
              </Link>
              <div className="shrink-0">
                <RunActions jobId={run.jobId} queueName={run.queue} status="active" />
              </div>
            </li>
          ))}
        </ul>
        {hiddenCount > 0 && (
          <Link href={getRunsHref({ status: "active" })} className="mt-1 inline-block text-xs">
            and {hiddenCount.toLocaleString()} more
          </Link>
        )}
      </AlertDescription>
    </Alert>
  )
}
