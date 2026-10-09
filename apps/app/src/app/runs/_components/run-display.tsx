import { AlertTriangle } from "lucide-react"

import { describeStuckRun, type StuckRun } from "~/lib/utils/stuck-runs"

type StuckRunWarningProps = {
  stuckRun: StuckRun | undefined
}

export function StuckRunWarning({ stuckRun }: StuckRunWarningProps) {
  if (!stuckRun) return null

  const description = describeStuckRun(stuckRun)

  return (
    <span title={`Looks stuck. ${description}`}>
      <AlertTriangle aria-hidden className="size-4 text-warning" />
      <span className="sr-only">{`Looks stuck. ${description}`}</span>
    </span>
  )
}
