"use client"

import { Button } from "@better-bull-board/ui/components/button"
import { Popover, PopoverContent, PopoverTrigger } from "@better-bull-board/ui/components/popover"
import { Separator } from "@better-bull-board/ui/components/separator"
import { CalendarDays } from "lucide-react"
import { parseAsNumberLiteral } from "nuqs"
import { Fragment, useState, useSyncExternalStore } from "react"

const MINUTE = 1
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** Length of the period ending now, in minutes */
export type TimePeriod = number

type TimePeriodOption = { value: TimePeriod; label: string }

const timePeriodGroups: TimePeriodOption[][] = [
  [
    { value: 5 * MINUTE, label: "Last 5 minutes" },
    { value: 15 * MINUTE, label: "Last 15 minutes" },
    { value: 30 * MINUTE, label: "Last 30 minutes" },
  ],
  [
    { value: 1 * HOUR, label: "Last 1 hour" },
    { value: 3 * HOUR, label: "Last 3 hours" },
    { value: 6 * HOUR, label: "Last 6 hours" },
    { value: 12 * HOUR, label: "Last 12 hours" },
  ],
  [
    { value: 1 * DAY, label: "Last 1 day" },
    { value: 3 * DAY, label: "Last 3 days" },
    { value: 7 * DAY, label: "Last 7 days" },
    { value: 30 * DAY, label: "Last 30 days" },
  ],
]

const timePeriodOptions = timePeriodGroups.flat()

export const DEFAULT_TIME_PERIOD: TimePeriod = 6 * HOUR

const isTimePeriod = (value: unknown): value is TimePeriod =>
  timePeriodOptions.some((option) => option.value === value)

/** Period in a shared link, in minutes: anything other than the selector options is ignored */
export const parseAsTimePeriod = parseAsNumberLiteral(
  timePeriodOptions.map((option) => option.value),
)

export const getTimePeriodLabel = (value: TimePeriod) =>
  timePeriodOptions.find((option) => option.value === value)?.label ?? "Last 6 hours"

const STORAGE_KEY = "better-bull-board:dashboard-time-period"
const listeners = new Set<() => void>()
// The stored value, read once: also keeps the choice for this page when storage is unavailable
let currentTimePeriod: TimePeriod | undefined

const readStorage = (): TimePeriod => {
  try {
    const value = Number(window.localStorage.getItem(STORAGE_KEY))
    return isTimePeriod(value) ? value : DEFAULT_TIME_PERIOD
  } catch {
    return DEFAULT_TIME_PERIOD
  }
}

const getTimePeriodSnapshot = () => {
  currentTimePeriod ??= readStorage()
  return currentTimePeriod
}

const notifyListeners = () => {
  for (const listener of listeners) listener()
}

// A choice made in another tab
const handleStorage = (event: StorageEvent) => {
  if (event.key !== STORAGE_KEY) return
  currentTimePeriod = readStorage()
  notifyListeners()
}

const subscribeToTimePeriod = (listener: () => void) => {
  if (listeners.size === 0) window.addEventListener("storage", handleStorage)
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) window.removeEventListener("storage", handleStorage)
  }
}

const setStoredTimePeriod = (value: TimePeriod) => {
  currentTimePeriod = value
  try {
    window.localStorage.setItem(STORAGE_KEY, String(value))
  } catch {
    // Storage unavailable (private mode, blocked site data): the choice lasts until the page is reloaded
  }
  notifyListeners()
}

/**
 * Dashboard time period, remembered in this browser so it survives navigating away and back.
 * `null` while hydrating: the server cannot know the stored value, and fetching the default first would be wasted.
 */
export const useStoredTimePeriod = () =>
  [
    useSyncExternalStore(subscribeToTimePeriod, getTimePeriodSnapshot, () => null),
    setStoredTimePeriod,
  ] as const

interface TimePeriodSelectorProps {
  value: TimePeriod
  onChange: (period: TimePeriod) => void
}

export function TimePeriodSelector({ value, onChange }: TimePeriodSelectorProps) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="outline" />}>
        <CalendarDays className="h-4 w-4" />
        {getTimePeriodLabel(value)}
      </PopoverTrigger>
      <PopoverContent className="w-48 p-2" align="start">
        <div className="space-y-1">
          {timePeriodGroups.map((group, index) => (
            <Fragment key={group[0]?.value}>
              {index > 0 && <Separator className="my-1" />}
              {group.map((option) => (
                <Button
                  key={option.value}
                  variant={value === option.value ? "default" : "ghost"}
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => {
                    onChange(option.value)
                    setOpen(false)
                  }}
                >
                  {option.label}
                </Button>
              ))}
            </Fragment>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
