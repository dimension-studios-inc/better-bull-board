import { AlertTriangle } from "lucide-react"
import { formatDurationMs } from "~/lib/utils/duration"
import { describeStuckRun, type StuckRun } from "~/lib/utils/stuck-runs"

// Finished runs only: the time between start and finish, short enough for a narrow column
export const getRunDuration = (run: { status: string; startedAt: Date | null; finishedAt: Date | null }) =>
  run.startedAt && run.finishedAt && (run.status === "completed" || run.status === "failed")
    ? formatDurationMs(run.finishedAt.getTime() - run.startedAt.getTime())
    : null

type StuckRunWarningProps = {
  stuckRun: StuckRun | undefined
}

export function StuckRunWarning({ stuckRun }: StuckRunWarningProps) {
  if (!stuckRun) return null

  const description = describeStuckRun(stuckRun)

  return (
    <span role="img" aria-label={`Looks stuck. ${description}`} title={`Looks stuck. ${description}`}>
      <AlertTriangle className="size-4 text-warning" />
    </span>
  )
}
