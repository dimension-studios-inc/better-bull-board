import { UTCDate } from "@date-fns/utc"
import { format } from "date-fns"

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

/**
 * Format a date in UTC, whatever the time zone of the browser or the server.
 *
 * Absolute times are shown in UTC across the app: runs are stored in UTC and the runs API filters read UTC.
 */
export const formatUtc = (value: Date | number | string, pattern: string) =>
  format(new UTCDate(new Date(value).getTime()), pattern)

/** "2026-10-02 08:30:00 UTC" */
export const formatUtcDateTime = (value: Date | number | string, { milliseconds = false } = {}) =>
  `${formatUtc(value, milliseconds ? "yyyy-MM-dd HH:mm:ss.SSS" : "yyyy-MM-dd HH:mm:ss")} UTC`

/** Start of the UTC hour (date-fns startOfHour uses the local time zone) */
export const startOfUtcHour = (value: Date | number) =>
  new Date(Math.floor(new Date(value).getTime() / HOUR_MS) * HOUR_MS)

/** Start of the UTC day (date-fns startOfDay uses the local time zone) */
export const startOfUtcDay = (value: Date | number) => new Date(Math.floor(new Date(value).getTime() / DAY_MS) * DAY_MS)
