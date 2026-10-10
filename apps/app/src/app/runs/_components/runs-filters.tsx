"use client"

import { Badge } from "@better-bull-board/ui/components/badge"
import { Button, buttonVariants } from "@better-bull-board/ui/components/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@better-bull-board/ui/components/input-group"
import { Popover, PopoverContent, PopoverTrigger } from "@better-bull-board/ui/components/popover"
import { useQuery } from "@tanstack/react-query"
import { cn } from "cn"
import { ChevronLeft, ChevronRight, Filter, Pause, Plus, Search, X } from "lucide-react"
import Link from "next/link"
import { useId, useMemo, useState } from "react"

import { getTagsApiRoute } from "~/app/api/tags/schemas"
import { DateTimePicker } from "~/components/date-time-picker"
import { QueueSelector } from "~/components/queue-selector"
import { SearchSelect, type SearchSelectOption } from "~/components/search-select"
import useDebounce from "~/hooks/use-debounce"
import { apiFetch } from "~/lib/utils/client"

import { formatCreatedFilterLabel } from "./run-format"
import type { TRunFilters, TRunFilterUpdate } from "./types"

const MIN_TAG_SEARCH_LENGTH = 2

const STATUS_OPTIONS: SearchSelectOption[] = [
  { value: "all", label: "All Statuses" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
  { value: "active", label: "Active" },
  { value: "waiting", label: "Waiting" },
  { value: "delayed", label: "Delayed" },
  { value: "prioritized", label: "Prioritized" },
  { value: "waiting-children", label: "Waiting Children" },
]

const renderStatusValue = (value: string) =>
  STATUS_OPTIONS.find((option) => option.value === value)?.label ?? "All Statuses"

type TActiveFilter = {
  key: "queue" | "status" | "tags" | "createdFrom" | "createdTo"
  label: string
  value: string
}

const getActiveFilters = (filters: TRunFilters): TActiveFilter[] => [
  ...(filters.queue && filters.queue !== "all"
    ? [{ key: "queue" as const, label: filters.queue, value: filters.queue }]
    : []),
  ...(filters.status && filters.status !== "all"
    ? [{ key: "status" as const, label: renderStatusValue(filters.status), value: filters.status }]
    : []),
  ...filters.tags.map((tag) => ({ key: "tags" as const, label: tag, value: tag })),
  ...(filters.createdFrom
    ? [
        {
          key: "createdFrom" as const,
          label: `Created from ${formatCreatedFilterLabel(filters.createdFrom)}`,
          value: filters.createdFrom,
        },
      ]
    : []),
  ...(filters.createdTo
    ? [
        {
          key: "createdTo" as const,
          label: `Created to ${formatCreatedFilterLabel(filters.createdTo)}`,
          value: filters.createdTo,
        },
      ]
    : []),
]

const FILTER_RESETS: Record<Exclude<TActiveFilter["key"], "tags">, TRunFilterUpdate> = {
  queue: { queue: "all" },
  status: { status: "all" },
  createdFrom: { createdFrom: "" },
  createdTo: { createdTo: "" },
}

// The update that clears one active filter
const getFilterRemoval = (filter: TActiveFilter, filters: TRunFilters): TRunFilterUpdate =>
  filter.key === "tags"
    ? { cursor: null, tags: filters.tags.filter((tag) => tag !== filter.value) }
    : { cursor: null, ...FILTER_RESETS[filter.key] }

type TFiltersFieldProps = {
  filters: TRunFilters
  setFilters: (filters: TRunFilterUpdate) => void
}

function TagsFilter({ filters, setFilters }: TFiltersFieldProps) {
  const [tagsOpen, setTagsOpen] = useState(false)
  const [tagsSearch, setTagsSearch] = useState("")
  const tagsId = useId()
  const debouncedTagsSearch = useDebounce(tagsSearch, 250)

  const { data: tagsData, isFetching: isTagsFetching } = useQuery({
    queryKey: ["tags", debouncedTagsSearch],
    queryFn: apiFetch({
      apiRoute: getTagsApiRoute,
      body: { search: debouncedTagsSearch },
    }),
    enabled: tagsOpen && debouncedTagsSearch.length >= MIN_TAG_SEARCH_LENGTH,
  })

  // Tags already filtered on are not offered again
  const tagsOptions: SearchSelectOption[] = useMemo(() => {
    const selectedTags = new Set(filters.tags)
    return (tagsData?.tags ?? [])
      .filter((tag) => !selectedTags.has(tag))
      .map((tag) => ({ value: tag, label: tag }))
  }, [tagsData, filters.tags])

  return (
    <div>
      <label htmlFor={tagsId} className="mb-2 block text-sm font-medium">
        Tags
      </label>
      <div className="space-y-2">
        {filters.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {filters.tags.map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="ml-1 size-3"
                  aria-label={`Remove the ${tag} tag`}
                  onClick={() => {
                    const newTags = filters.tags.filter((t) => t !== tag)
                    setFilters({ tags: newTags })
                  }}
                >
                  <X className="size-2" />
                </Button>
              </Badge>
            ))}
          </div>
        )}
        <SearchSelect
          id={tagsId}
          value=""
          onValueChange={(value) => {
            if (value && !filters.tags.includes(value)) {
              setFilters({ tags: [...filters.tags, value] })
            }
            setTagsSearch("")
          }}
          options={tagsOptions}
          placeholder="Type to search tags..."
          noOptionsMessage={
            debouncedTagsSearch.length < MIN_TAG_SEARCH_LENGTH
              ? "Type at least 2 characters"
              : "No tags found"
          }
          searchPlaceholder="Search tags..."
          search={tagsSearch}
          setSearch={setTagsSearch}
          open={tagsOpen}
          setOpen={setTagsOpen}
          renderValue={() => ""}
          className="w-full"
          isFetching={isTagsFetching}
        />
        <div className="text-xs text-muted-foreground">Start typing to search (2+ chars).</div>
      </div>
    </div>
  )
}

function FilterOptions({ filters, setFilters }: TFiltersFieldProps) {
  const [queueOpen, setQueueOpen] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const [queueSearch, setQueueSearch] = useState("")
  const [statusSearch, setStatusSearch] = useState("")
  const queueId = useId()
  const statusId = useId()

  return (
    <div className="space-y-4">
      <div className="text-sm font-medium">Filter Options</div>

      <div className="space-y-3">
        <div>
          <label htmlFor={queueId} className="mb-2 block text-sm font-medium">
            Queue
          </label>
          <QueueSelector
            id={queueId}
            value={filters.queue}
            onValueChange={(value) => setFilters({ queue: value })}
            search={queueSearch}
            setSearch={setQueueSearch}
            open={queueOpen}
            setOpen={setQueueOpen}
            placeholder="All Queues"
            className="w-full"
            includeAllOption={true}
            allOptionLabel="All Queues"
          />
        </div>

        <div>
          <label htmlFor={statusId} className="mb-2 block text-sm font-medium">
            Status
          </label>
          <SearchSelect
            id={statusId}
            value={filters.status}
            onValueChange={(value) => setFilters({ status: value })}
            options={STATUS_OPTIONS}
            placeholder="All Statuses"
            noOptionsMessage="No statuses found"
            searchPlaceholder="Search statuses..."
            search={statusSearch}
            setSearch={setStatusSearch}
            open={statusOpen}
            setOpen={setStatusOpen}
            renderValue={renderStatusValue}
            className="w-full"
          />
        </div>

        <TagsFilter filters={filters} setFilters={setFilters} />

        <fieldset>
          <legend className="mb-2 block text-sm font-medium">Created</legend>
          <div className="grid gap-2">
            <DateTimePicker
              value={filters.createdFrom}
              onChange={(createdFrom) => setFilters({ createdFrom })}
              placeholder="From"
              defaultTime="00:00:00"
              className="w-full"
              aria-label="Created from"
            />
            <DateTimePicker
              value={filters.createdTo}
              onChange={(createdTo) => setFilters({ createdTo })}
              placeholder="To"
              defaultTime="23:59:59"
              className="w-full"
              aria-label="Created to"
            />
          </div>
        </fieldset>
      </div>
    </div>
  )
}

export function RunsFilters({
  filters,
  setFilters,
  runs,
  isPageLoading,
  liveUpdatesPaused,
  onLiveUpdatesPausedChange,
  startEndContent,
}: {
  filters: TRunFilters
  setFilters: (filters: TRunFilterUpdate) => void
  runs?: {
    nextCursor: { createdAt: number; jobId: string; id: string; durationMs?: number | null } | null
    prevCursor: { createdAt: number; jobId: string; id: string; durationMs?: number | null } | null
  }
  /** A page is loading: background refreshes of the current page keep the pagination usable */
  isPageLoading?: boolean
  liveUpdatesPaused: boolean
  onLiveUpdatesPausedChange: (paused: boolean) => void
  startEndContent?: React.ReactNode
}) {
  const [filtersOpen, setFiltersOpen] = useState(false)
  const activeFilters = getActiveFilters(filters)

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
          <PopoverTrigger render={<Button variant="outline" aria-label="Filters" />}>
            <Filter className="h-4 w-4" />
            <span className="max-md:hidden">Filters</span>
            {activeFilters.length > 0 && (
              <Badge variant="secondary" className="min-w-5">
                {activeFilters.length}
              </Badge>
            )}
          </PopoverTrigger>
          <PopoverContent className="w-80 max-w-(--available-width)" align="start">
            <FilterOptions filters={filters} setFilters={setFilters} />
          </PopoverContent>
        </Popover>
        <InputGroup className="flex-1 md:max-w-96">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            placeholder="Search ID, name, error…"
            value={filters.search}
            onChange={(e) => setFilters({ search: e.target.value })}
          />
        </InputGroup>
        <div className="ml-auto flex items-center gap-2">
          {/* On phones the live toggle sits above the list and the pagination below it */}
          <LiveUpdatesToggle
            paused={liveUpdatesPaused}
            onPausedChange={onLiveUpdatesPausedChange}
            className="max-md:hidden"
          />
          <Link
            href="/runs/create"
            aria-label="Create run"
            className={cn(buttonVariants(), "max-md:w-8")}
          >
            <Plus className="h-4 w-4" />
            <span className="max-md:hidden">Create Run</span>
          </Link>
          <RunsPagination
            runs={runs}
            filters={filters}
            setFilters={setFilters}
            isPageLoading={isPageLoading}
            className="max-md:hidden"
          />
        </div>
      </div>
      {(activeFilters.length > 0 || startEndContent) && (
        <div className="flex flex-wrap items-center gap-2">
          {activeFilters.map((filter) => (
            <Badge key={`${filter.key}-${filter.value}`} variant="secondary" className="max-w-full">
              <span className="truncate">{filter.label}</span>
              <Button
                variant="ghost"
                size="icon-xs"
                className="size-4"
                aria-label={`Remove the ${filter.label} filter`}
                onClick={() => setFilters(getFilterRemoval(filter, filters))}
              >
                <X className="size-3" />
              </Button>
            </Badge>
          ))}
          {startEndContent}
        </div>
      )}
    </div>
  )
}

type RunsPaginationProps = {
  runs?: {
    nextCursor: { createdAt: number; jobId: string; id: string; durationMs?: number | null } | null
    prevCursor: { createdAt: number; jobId: string; id: string; durationMs?: number | null } | null
  }
  filters: TRunFilters
  setFilters: (filters: TRunFilterUpdate) => void
  /** A page is loading: background refreshes of the current page keep the pagination usable */
  isPageLoading?: boolean
  className?: string
}

export function RunsPagination({
  runs,
  filters,
  setFilters,
  isPageLoading,
  className,
}: RunsPaginationProps) {
  const handleNextPage = () => {
    if (runs?.nextCursor) {
      setFilters({
        cursor: runs.nextCursor,
        cursorDirection: "next",
      })
    }
  }

  const handlePrevPage = () => {
    if (runs?.prevCursor) {
      setFilters({
        cursor: runs.prevCursor,
        cursorDirection: "prev",
      })
    } else {
      setFilters({ cursor: null, cursorDirection: "next" })
    }
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Button
        variant="outline"
        onClick={handlePrevPage}
        disabled={isPageLoading || (!runs?.prevCursor && !filters.cursor)}
        aria-label="Previous page"
        className="flex-1"
      >
        <ChevronLeft className="h-4 w-4" />
        Previous
      </Button>
      <Button
        variant="outline"
        onClick={handleNextPage}
        disabled={isPageLoading || !runs?.nextCursor}
        aria-label="Next page"
        className="flex-1"
      >
        Next
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}

type LiveUpdatesToggleProps = {
  paused: boolean
  onPausedChange: (paused: boolean) => void
  className?: string
}

/** Says whether the list follows new runs, rather than a bare pause icon */
export function LiveUpdatesToggle({ paused, onPausedChange, className }: LiveUpdatesToggleProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => onPausedChange(!paused)}
      aria-pressed={paused}
      title={paused ? "Live updates paused: click to resume" : "Following new runs: click to pause"}
      className={className}
    >
      {paused ? (
        <Pause className="size-3.5" />
      ) : (
        <span className="size-2 rounded-full bg-success motion-safe:animate-pulse" aria-hidden />
      )}
      {paused ? "Paused" : "Live"}
    </Button>
  )
}
