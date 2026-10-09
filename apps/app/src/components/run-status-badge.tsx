import { Badge } from "@better-bull-board/ui/components/badge"
import { cn } from "cn"
import {
  CircleCheck,
  CircleQuestionMark,
  CircleX,
  Clock,
  Hourglass,
  LoaderCircle,
  type LucideIcon,
  type LucideProps,
} from "lucide-react"
import type { ComponentProps } from "react"

type BadgeVariant = ComponentProps<typeof Badge>["variant"]

// The shadcn Badge variants carry the status, the icon tells statuses of the same variant apart
const runStatuses: Record<
  string,
  { variant: BadgeVariant; icon: LucideIcon; iconClassName?: string }
> = {
  completed: { variant: "outline", icon: CircleCheck, iconClassName: "text-success" },
  failed: { variant: "destructive", icon: CircleX, iconClassName: "text-destructive" },
  active: { variant: "secondary", icon: LoaderCircle, iconClassName: "animate-spin" },
  waiting: { variant: "outline", icon: Clock, iconClassName: "text-muted-foreground" },
  delayed: { variant: "outline", icon: Hourglass, iconClassName: "text-muted-foreground" },
  prioritized: { variant: "outline", icon: Hourglass, iconClassName: "text-muted-foreground" },
  "waiting-children": {
    variant: "outline",
    icon: Hourglass,
    iconClassName: "text-muted-foreground",
  },
}

const unknownStatus = {
  variant: "outline",
  icon: CircleQuestionMark,
  iconClassName: "text-muted-foreground",
} as const

type RunStatusProps = {
  status: string
  className?: string
}

export function RunStatusIcon({
  status,
  className,
  ...props
}: RunStatusProps & Omit<LucideProps, "ref">) {
  const { icon: Icon, iconClassName } = runStatuses[status] ?? unknownStatus
  return <Icon className={cn(iconClassName, className)} aria-hidden {...props} />
}

export function RunStatusBadge({ status, className }: RunStatusProps) {
  const { variant } = runStatuses[status] ?? unknownStatus

  return (
    <Badge variant={variant} className={className}>
      <RunStatusIcon status={status} data-icon="inline-start" />
      {status}
    </Badge>
  )
}
