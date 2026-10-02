import { Tooltip, TooltipContent, TooltipTrigger } from "@better-bull-board/ui/components/tooltip"
import { cn } from "cn"

type TruncatedTooltipProps = {
  value: string
  className?: string
}

export function TruncatedTooltip({ value, className }: TruncatedTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn("inline-block max-w-full truncate align-bottom", className)}>{value}</span>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        sideOffset={6}
        className="max-w-[min(32rem,calc(100vw-2rem))] whitespace-normal break-all text-left"
      >
        {value}
      </TooltipContent>
    </Tooltip>
  )
}
