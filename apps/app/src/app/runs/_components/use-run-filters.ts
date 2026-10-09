import { createParser, parseAsString, useQueryStates } from "nuqs"
import { useMemo, useRef } from "react"

import useDebounce from "~/hooks/use-debounce"

import type { TRunFilters, TRunFilterUpdate } from "./types"

const parseAsCursor = createParser<NonNullable<TRunFilters["cursor"]>>({
  parse: (value) => {
    try {
      return JSON.parse(Buffer.from(value, "base64").toString("utf-8")) as NonNullable<
        TRunFilters["cursor"]
      >
    } catch {
      return null
    }
  },
  serialize: (value) => Buffer.from(JSON.stringify(value)).toString("base64"),
})

/**
 * Runs list filters, kept in the URL. `queryFilters` debounces typing but not pagination;
 * `onChange` runs on every update (the selection does not survive a filter or page change).
 */
export const useRunFilters = ({ onChange }: { onChange: () => void }) => {
  const [urlFilters, setUrlFilters] = useQueryStates({
    queue: parseAsString.withDefault("all"),
    status: parseAsString.withDefault("all"),
    search: parseAsString.withDefault(""),
    tags: parseAsString.withDefault(""),
    createdFrom: parseAsString.withDefault(""),
    createdTo: parseAsString.withDefault(""),
    sortBy: parseAsString.withDefault("createdAt"),
    sortDirection: parseAsString.withDefault("desc"),
    cursor: parseAsCursor,
    cursorDirection: parseAsString.withDefault("next"),
  })

  const cursorHistoryRef = useRef<TRunFilters["cursor"][]>([])
  const cursorCreatedAt = urlFilters.cursor?.createdAt
  const cursorJobId = urlFilters.cursor?.jobId
  const cursorId = urlFilters.cursor?.id
  const cursorDurationMs = urlFilters.cursor?.durationMs

  const filters: TRunFilters = useMemo(
    () => ({
      queue: urlFilters.queue,
      status: urlFilters.status,
      search: urlFilters.search,
      createdFrom: urlFilters.createdFrom,
      createdTo: urlFilters.createdTo,
      tags: urlFilters.tags ? urlFilters.tags.split(",").filter(Boolean) : [],
      sortBy: urlFilters.sortBy === "durationMs" ? "durationMs" : "createdAt",
      sortDirection: urlFilters.sortDirection === "asc" ? "asc" : "desc",
      cursor:
        cursorCreatedAt && cursorJobId && cursorId
          ? {
              createdAt: cursorCreatedAt,
              jobId: cursorJobId,
              id: cursorId,
              durationMs: cursorDurationMs,
            }
          : null,
      cursorDirection: urlFilters.cursorDirection === "prev" ? "prev" : "next",
      limit: 15,
    }),
    [
      urlFilters.queue,
      urlFilters.status,
      urlFilters.search,
      urlFilters.tags,
      urlFilters.createdFrom,
      urlFilters.createdTo,
      urlFilters.sortBy,
      urlFilters.sortDirection,
      cursorCreatedAt,
      cursorJobId,
      cursorId,
      cursorDurationMs,
      urlFilters.cursorDirection,
    ],
  )

  const debouncedFilters = useDebounce(filters, 300)
  const queryFilters =
    filters.cursor || filters.cursorDirection === "prev" ? filters : debouncedFilters

  const setFilters = (requestedFilters: TRunFilterUpdate) => {
    let newFilters = requestedFilters
    const isPaginationOnly = Object.keys(newFilters).every(
      (key) => key === "cursor" || key === "cursorDirection",
    )
    const urlUpdate: Record<string, unknown> = isPaginationOnly
      ? {}
      : { cursor: null, cursorDirection: "next" }

    if (isPaginationOnly && newFilters.cursorDirection === "next") {
      cursorHistoryRef.current.push(filters.cursor)
    }

    if (isPaginationOnly && newFilters.cursorDirection === "prev") {
      const previousCursor = cursorHistoryRef.current.pop()

      if (previousCursor !== undefined) {
        newFilters = { cursor: previousCursor, cursorDirection: "next" }
      }
    }

    if (!isPaginationOnly) {
      cursorHistoryRef.current = []
    }

    for (const [key, value] of Object.entries(newFilters)) {
      if (key === "tags" && Array.isArray(value)) {
        urlUpdate[key] = value.length > 0 ? value.join(",") : ""
      } else {
        urlUpdate[key] = value
      }
    }

    onChange()
    void setUrlFilters(urlUpdate)
  }

  return { filters, queryFilters, setFilters }
}
