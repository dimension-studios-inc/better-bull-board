import { jobRunsTable } from "@better-bull-board/db"
import { db } from "@better-bull-board/db/server"
import { utcTimestamp } from "@better-bull-board/db/utils/timestamp"
import { type SQL, sql } from "drizzle-orm"
import type { z } from "zod"

import { listTopErrorsInputSchema, listTopErrorsOutputSchema } from "./top-errors-schemas"

export { listTopErrorsInputSchema, listTopErrorsOutputSchema } from "./top-errors-schemas"

type TopErrorRow = {
  queue: string
  normalized_message: string
  sample_message: string
  error_count: string | number
  first_seen_epoch_ms: string | number
  last_seen_epoch_ms: string | number
  scanned_runs: string | number
}

const TOP_ERRORS_LIMIT = 20
// Bounds the work on long periods: the latest failures are the ones worth grouping
const MAX_SCANNED_RUNS = 50_000
// Long messages (stack traces, payloads) are grouped and shown on their beginning only
const MAX_MESSAGE_LENGTH = 1000
const MAX_SEARCH_LENGTH = 100
const MIN_SEARCH_LENGTH = 3

// Applied in order: dates before numbers, uuids before hex ids, hex ids before numbers
const messageReplacements = [
  {
    pattern: String.raw`\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?`,
    placeholder: "<date>",
    flags: "g",
  },
  {
    pattern: "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}",
    placeholder: "<uuid>",
    flags: "gi",
  },
  { pattern: String.raw`\m(?:0x)?[0-9a-f]{16,}\M`, placeholder: "<id>", flags: "gi" },
  { pattern: String.raw`\d{4,}`, placeholder: "<n>", flags: "g" },
]

const placeholderPattern = new RegExp(
  `${messageReplacements.map(({ placeholder }) => placeholder).join("|")}|\n`,
)

const fragmentEdgesPattern = /^[\s\p{P}]+|[\s\p{P}]+$/gu

const toNumber = (value: string | number | null | undefined) => Number(value ?? 0)

const normalizeMessage = (message: SQL) =>
  messageReplacements.reduce(
    (normalized, { pattern, placeholder, flags }) =>
      sql`regexp_replace(${normalized}, ${pattern}, ${placeholder}, ${flags})`,
    message,
  )

/** Longest literal part of the message: every message of the group contains it */
const getSearch = (normalizedMessage: string) => {
  const longestFragment = normalizedMessage
    .split(placeholderPattern)
    .map((fragment) => fragment.replace(fragmentEdgesPattern, ""))
    .reduce((longest, fragment) => (fragment.length > longest.length ? fragment : longest), "")

  return longestFragment.length >= MIN_SEARCH_LENGTH
    ? longestFragment.slice(0, MAX_SEARCH_LENGTH).trim()
    : null
}

/**
 * Failed runs of the period grouped by queue and error message, with the variable parts of the messages
 * (ids, numbers, dates) replaced by placeholders so that recurring failures add up.
 */
export const listTopErrors = async (input: z.input<typeof listTopErrorsInputSchema> = {}) => {
  const { minutes, queue } = listTopErrorsInputSchema.parse(input)
  const dateFrom = new Date(Date.now() - minutes * 60 * 1000)

  // Reads the (status, created_at) or (queue, status, created_at) index backwards
  const result = await db.execute(sql`
    WITH failed_runs AS (
      SELECT
        ${jobRunsTable.queue} AS "queue",
        ${jobRunsTable.createdAt} AS "created_at",
        LEFT(COALESCE(${jobRunsTable.errorMessage}, ''), ${sql.raw(String(MAX_MESSAGE_LENGTH))}) AS "message"
      FROM ${jobRunsTable}
      WHERE ${jobRunsTable.status} = 'failed'
        AND ${jobRunsTable.createdAt} >= ${utcTimestamp(dateFrom)}
        ${queue ? sql`AND ${jobRunsTable.queue} = ${queue}` : sql``}
      ORDER BY ${jobRunsTable.createdAt} DESC
      LIMIT ${sql.raw(String(MAX_SCANNED_RUNS))}
    ),
    normalized_runs AS (
      SELECT "queue", "created_at", "message", ${normalizeMessage(sql`"message"`)} AS "normalized_message"
      FROM failed_runs
    )
    SELECT
      "queue",
      "normalized_message",
      MAX("message") AS "sample_message",
      COUNT(*)::bigint AS "error_count",
      (EXTRACT(EPOCH FROM MIN("created_at")) * 1000)::bigint AS "first_seen_epoch_ms",
      (EXTRACT(EPOCH FROM MAX("created_at")) * 1000)::bigint AS "last_seen_epoch_ms",
      (SELECT COUNT(*) FROM failed_runs)::bigint AS "scanned_runs"
    FROM normalized_runs
    GROUP BY "queue", "normalized_message"
    ORDER BY "error_count" DESC, "last_seen_epoch_ms" DESC
    LIMIT ${sql.raw(String(TOP_ERRORS_LIMIT))}
  `)
  const rows = result.rows as TopErrorRow[]
  const scannedRuns = toNumber(rows[0]?.scanned_runs)

  return listTopErrorsOutputSchema.parse({
    errors: rows.map((row) => ({
      queue: row.queue,
      normalizedMessage: row.normalized_message,
      sampleMessage: row.sample_message,
      search: getSearch(row.normalized_message),
      count: toNumber(row.error_count),
      firstSeenAt: toNumber(row.first_seen_epoch_ms),
      lastSeenAt: toNumber(row.last_seen_epoch_ms),
    })),
    scannedRuns,
    isPartial: scannedRuns >= MAX_SCANNED_RUNS,
  })
}
