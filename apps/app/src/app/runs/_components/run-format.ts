import { formatDurationMs } from "~/lib/utils/duration"

export const formatRunCount = (count: number) =>
  `${count.toLocaleString()} run${count === 1 ? "" : "s"}`

// Filter values are UTC date times without time zone
export const formatCreatedFilterLabel = (value: string) => `${value.replace("T", " ")} UTC`

// Finished runs only: the time between start and finish, short enough for a narrow column
export const getRunDuration = (run: {
  status: string
  startedAt: Date | null
  finishedAt: Date | null
}) =>
  run.startedAt && run.finishedAt && (run.status === "completed" || run.status === "failed")
    ? formatDurationMs(run.finishedAt.getTime() - run.startedAt.getTime())
    : null
