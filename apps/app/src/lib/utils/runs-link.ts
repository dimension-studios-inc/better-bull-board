import { formatUtc } from "./date"

type RunsHrefOptions = {
  queue?: string
  status?: string
  /** Only the runs created in this period ending now, in minutes, like the dashboard counts them */
  minutes?: number | null
}

/** Link to the runs page with its filters set */
export const getRunsHref = ({ queue, status, minutes }: RunsHrefOptions) => {
  const params = new URLSearchParams()
  if (queue) params.set("queue", queue)
  if (status) params.set("status", status)
  if (minutes) params.set("createdFrom", formatUtc(Date.now() - minutes * 60 * 1000, "yyyy-MM-dd'T'HH:mm:ss"))

  const query = params.toString()
  return query ? `/runs?${query}` : "/runs"
}
