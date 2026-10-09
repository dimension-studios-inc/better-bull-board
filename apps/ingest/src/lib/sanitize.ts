const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (value === null || typeof value !== "object") return false
  const prototype: unknown = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

/**
 * Remove NUL characters from strings, deeply in arrays and plain objects (keys included).
 *
 * PostgreSQL rejects them in text values ("invalid byte sequence for encoding UTF8: 0x00") and their \u0000
 * escape in jsonb. A single one made a whole batch insert fail, and the batch was retried forever from the stream.
 * Other values (dates, numbers...) are returned as is.
 */
export const stripNullCharacters = <T>(value: T): T => {
  if (typeof value === "string") return value.replaceAll("\u0000", "") as T
  if (Array.isArray(value)) return value.map(stripNullCharacters) as T
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        stripNullCharacters(key),
        stripNullCharacters(entry),
      ]),
    ) as T
  }
  return value
}
