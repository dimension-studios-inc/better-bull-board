import { type Column, type SQL, sql } from "drizzle-orm"
import type { PgTable } from "drizzle-orm/pg-core"

export function conflictUpdateSet<
  TTable extends PgTable,
  TColumn extends keyof TTable["_"]["columns"] & keyof TTable,
>(table: TTable, columns: TColumn[]): Record<TColumn, SQL> {
  return Object.fromEntries(
    columns.map((k) => [k, sql.raw(`excluded.${(table[k] as Column).name}`)]),
  ) as Record<TColumn, SQL>
}
