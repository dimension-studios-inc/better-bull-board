import cronstrue from "cronstrue"
import { formatDuration } from "date-fns"

const SECOND_MS = 1000

/** "Every 5 minutes", "Every hour", "Every 1 hour, 30 minutes" */
const describeEvery = (every: number) => {
  if (every % SECOND_MS !== 0) return `Every ${every} ms`

  const totalSeconds = every / SECOND_MS
  const duration = formatDuration(
    {
      days: Math.floor(totalSeconds / 86_400),
      hours: Math.floor((totalSeconds % 86_400) / 3600),
      minutes: Math.floor((totalSeconds % 3600) / 60),
      seconds: totalSeconds % 60,
    },
    { delimiter: ", " },
  )

  return `Every ${duration.replace(/^1 (\w+)$/, "$1")}`
}

const describePattern = (pattern: string) => {
  try {
    return cronstrue.toString(pattern, { use24HourTimeFormat: true })
  } catch {
    return pattern
  }
}

export const describeSchedule = ({
  pattern,
  every,
  tz,
}: {
  pattern: string | null
  every: number | null
  tz: string | null
}) => {
  if (pattern) return tz ? `${describePattern(pattern)} (${tz})` : describePattern(pattern)
  if (every) return describeEvery(every)
  return "-"
}
