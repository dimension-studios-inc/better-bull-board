import { sql, Table } from "drizzle-orm";
import type { PgTable, PgTableWithColumns } from "drizzle-orm/pg-core";

/**
 * Omits specified properties from an object
 * @param obj - The source object to omit properties from
 * @param keys - A string or array of strings representing the keys to omit
 * @returns A new object with the specified keys omitted
 * @example
 * ```typescript
 * const obj = { a: 1, b: 2, c: 3 };
 * omit(obj, 'a'); // { b: 2, c: 3 }
 * omit(obj, ['a', 'b']); // { c: 3 }
 * ```
 */
export function omit<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: K | K[],
): Omit<T, K> {
  const keysToOmit = Array.isArray(keys) ? keys : [keys];
  const result = { ...obj };

  for (const key of keysToOmit) {
    delete result[key];
  }

  return result;
}

// biome-ignore lint/suspicious/noExplicitAny: _
export const tableToJsonColumn = <T extends PgTableWithColumns<any>>(
  table: T,
) => {
  const columns = table[
    // biome-ignore lint/suspicious/noExplicitAny: _
    (Table as any).Symbol.Columns
  ] as PgTable["_"]["columns"];

  const content = Object.entries(columns).reduce((acc, [key, column]) => {
    acc.push(
      `'${column.name}'`,
      // biome-ignore lint/suspicious/noExplicitAny: _
      `"${table[(Table as any).Symbol.BaseName]}"."${table[key].name}"`,
    );
    return acc;
  }, [] as string[]);

  return sql.raw(`json_agg(json_build_object(${content.join(",")}))`);
};
