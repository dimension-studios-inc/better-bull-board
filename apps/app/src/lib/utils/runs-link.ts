import { formatUtc } from "./date"

type RunsHrefOptions = {
  queue?: string
  status?: string
  /** Only the runs created in this period ending now, in minutes, like the dashboard counts them */
  minutes?: number | null
  /** Text contained in the run name, queue, job id or error message */
  search?: string | null
}

/** Link to the runs page with its filters set */
export const getRunsHref = ({ queue, status, minutes, search }: RunsHrefOptions) => {
  const params = new URLSearchParams()
  if (queue) params.set("queue", queue)
  if (status) params.set("status", status)
  if (search) params.set("search", search)
  if (minutes) params.set("createdFrom", formatUtc(Date.now() - minutes * 60 * 1000, "yyyy-MM-dd'T'HH:mm:ss"))

  const query = params.toString()
  return query ? `/runs?${query}` : "/runs"
}
