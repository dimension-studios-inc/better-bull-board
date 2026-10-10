"use client"

import { Button } from "@better-bull-board/ui/components/button"
import { Popover, PopoverContent, PopoverTrigger } from "@better-bull-board/ui/components/popover"
import { Separator } from "@better-bull-board/ui/components/separator"
import { CalendarDays } from "lucide-react"
import { Fragment, useState } from "react"

import { getTimePeriodLabel, type TimePeriod, timePeriodGroups } from "~/lib/time-period"

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
      <PopoverContent className="w-48" align="start">
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
