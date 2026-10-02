import { sql } from "drizzle-orm"

/**
 * Timestamp parameter for raw SQL, compared with `timestamp` (without time zone) columns, which store UTC.
 *
 * node-postgres serializes Date parameters in the server's local time zone and PostgreSQL drops the offset when
 * casting to `timestamp`: pass the UTC wall time instead. Drizzle column helpers (gte(column, date)...) already do.
 */
export const utcTimestamp = (date: Date) => sql`${date.toISOString().slice(0, 23)}::timestamp`
