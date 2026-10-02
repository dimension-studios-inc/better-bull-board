"use client"

import { Button } from "@better-bull-board/ui/components/button"
import { Popover, PopoverContent, PopoverTrigger } from "@better-bull-board/ui/components/popover"
import { Separator } from "@better-bull-board/ui/components/separator"
import { CalendarDays } from "lucide-react"
import { Fragment, useState } from "react"

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

export const DEFAULT_TIME_PERIOD: TimePeriod = 1 * DAY

export const getTimePeriodLabel = (value: TimePeriod) =>
  timePeriodGroups.flat().find((option) => option.value === value)?.label ?? "Last 1 day"

interface TimePeriodSelectorProps {
  value: TimePeriod
  onChange: (period: TimePeriod) => void
}

export function TimePeriodSelector({ value, onChange }: TimePeriodSelectorProps) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="outline" size="sm" className="gap-2" />}>
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
