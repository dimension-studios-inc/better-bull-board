"use client";

import { CalendarDays } from "lucide-react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";

export type TimePeriod = "1" | "3" | "7" | "30";

interface TimePeriodSelectorProps {
  value: TimePeriod;
  onChange: (period: TimePeriod) => void;
}

const timePeriodOptions: { value: TimePeriod; label: string }[] = [
  { value: "1", label: "1 day" },
  { value: "3", label: "3 days" },
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
];

export function TimePeriodSelector({
  value,
  onChange,
}: TimePeriodSelectorProps) {
  const [open, setOpen] = useState(false);

  const selectedOption = timePeriodOptions.find(
    (option) => option.value === value,
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <CalendarDays className="h-4 w-4" />
          {selectedOption?.label || "1 day"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-2" align="start">
        <div className="space-y-1">
          {timePeriodOptions.map((option) => (
            <Button
              key={option.value}
              variant={value === option.value ? "default" : "ghost"}
              size="sm"
              className="w-full justify-start"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}