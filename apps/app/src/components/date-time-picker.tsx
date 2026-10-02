"use client"

import { Button } from "@better-bull-board/ui/components/button"
import { Calendar } from "@better-bull-board/ui/components/calendar"
import { Input } from "@better-bull-board/ui/components/input"
import { Popover, PopoverContent, PopoverTrigger } from "@better-bull-board/ui/components/popover"
import { cn } from "cn"
import { format, isValid, parse } from "date-fns"
import { CalendarDays } from "lucide-react"
import { useState } from "react"

const DATE_FORMAT = "yyyy-MM-dd"

interface DateTimePickerProps {
  /** UTC date time without time zone: "yyyy-MM-dd", "yyyy-MM-ddTHH:mm" or "yyyy-MM-ddTHH:mm:ss", or "" */
  value: string
  onChange: (value: string) => void
  placeholder: string
  /** Time used when a day is picked without a time yet */
  defaultTime: string
  className?: string
  "aria-label"?: string
}

const splitValue = (value: string, defaultTime: string) => {
  const [datePart = "", timePart] = value.split("T")
  const date = datePart ? parse(datePart, DATE_FORMAT, new Date()) : undefined
  return {
    date: date && isValid(date) ? date : undefined,
    datePart,
    time: timePart || defaultTime,
  }
}

/**
 * Day + time picker built on the shadcn Calendar. Values stay plain UTC date time strings, as the runs API expects.
 */
export function DateTimePicker({
  value,
  onChange,
  placeholder,
  defaultTime,
  className,
  "aria-label": ariaLabel,
}: DateTimePickerProps) {
  const [open, setOpen] = useState(false)
  const { date, datePart, time } = splitValue(value, defaultTime)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            aria-label={ariaLabel}
            className={cn("justify-start font-normal", !value && "text-muted-foreground", className)}
          />
        }
      >
        <CalendarDays />
        {date ? (
          <span className="truncate">
            {datePart} {time} <span className="text-muted-foreground">UTC</span>
          </span>
        ) : (
          placeholder
        )}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          defaultMonth={date}
          onSelect={(day) => onChange(day ? `${format(day, DATE_FORMAT)}T${time}` : "")}
        />
        <div className="flex items-center gap-2 border-t p-3">
          <Input
            type="time"
            step={1}
            value={time}
            disabled={!date}
            onChange={(event) => onChange(`${datePart}T${event.target.value || defaultTime}`)}
            aria-label={ariaLabel ? `${ariaLabel} time (UTC)` : "Time (UTC)"}
            className="appearance-none bg-background [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
          />
          <span className="text-xs text-muted-foreground">UTC</span>
          {value && (
            <Button variant="ghost" size="sm" className="ml-auto" onClick={() => onChange("")}>
              Clear
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
