import type { z } from "zod"

import type { getStuckRunsApiRoute } from "~/app/api/jobs/stuck/schemas"

export type StuckRun = z.output<(typeof getStuckRunsApiRoute)["outputSchema"]>["runs"][number]

export const STUCK_RUNS_REFETCH_INTERVAL_MS = 30 * 1000

/** "850ms", "3.4s", "42m", "2h 5m", "3d 4h" */
export const formatShortDuration = (ms: number) => {
  if (ms < 1000) return `${Math.round(ms)}ms`
  if (ms < 60 * 1000) return `${Number((ms / 1000).toFixed(1))}s`

  const totalMinutes = Math.floor(ms / (60 * 1000))
  if (totalMinutes < 60) return `${totalMinutes}m`

  const totalHours = Math.floor(totalMinutes / 60)
  if (totalHours < 24)
    return totalMinutes % 60 ? `${totalHours}h ${totalMinutes % 60}m` : `${totalHours}h`

  const days = Math.floor(totalHours / 24)
  return totalHours % 24 ? `${days}d ${totalHours % 24}h` : `${days}d`
}

/** "usually under 3.4s": 95% of the queue's completed runs of the last 7 days took less */
export const formatUsualDuration = (run: StuckRun) =>
  run.p95Ms === null
    ? "no completed run in 7 days"
    : `usually under ${formatShortDuration(run.p95Ms)}`

/** The full reasoning, for a tooltip */
export const describeStuckRun = (run: StuckRun) => {
  const baseline =
    run.p95Ms === null
      ? "Its queue has no completed run in the last 7 days"
      : `95% of the last ${run.sampleSize.toLocaleString()} completed runs of its queue (7 days) took under ${formatShortDuration(run.p95Ms)}`

  const worker = run.workerId ? ` Worker: ${run.workerId}.` : ""

  return `Active for ${formatShortDuration(run.runningForMs)}. ${baseline}, so it is flagged past ${formatShortDuration(run.thresholdMs)}.${worker}`
}
