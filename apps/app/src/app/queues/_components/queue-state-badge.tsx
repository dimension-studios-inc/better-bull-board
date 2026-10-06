import { Badge } from "@better-bull-board/ui/components/badge"
import { CirclePause, CirclePlay } from "lucide-react"

type QueueStateBadgeProps = {
  isPaused: boolean
  className?: string
}

export function QueueStateBadge({ isPaused, className }: QueueStateBadgeProps) {
  return isPaused ? (
    <Badge variant="secondary" className={className}>
      <CirclePause data-icon="inline-start" aria-hidden />
      Paused
    </Badge>
  ) : (
    <Badge variant="outline" className={className}>
      <CirclePlay data-icon="inline-start" className="text-success" aria-hidden />
      Running
    </Badge>
  )
}
