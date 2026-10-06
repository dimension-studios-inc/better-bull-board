import { Badge } from "@better-bull-board/ui/components/badge"
import { cn } from "cn"
import { Bug, CircleAlert, Info, type LucideIcon, type LucideProps, TriangleAlert } from "lucide-react"
import type { ComponentProps } from "react"

type BadgeVariant = ComponentProps<typeof Badge>["variant"]

const logLevels: Record<string, { variant: BadgeVariant; icon: LucideIcon; iconClassName: string }> = {
  error: { variant: "destructive", icon: CircleAlert, iconClassName: "text-destructive" },
  warn: { variant: "outline", icon: TriangleAlert, iconClassName: "text-warning" },
  warning: { variant: "outline", icon: TriangleAlert, iconClassName: "text-warning" },
  info: { variant: "secondary", icon: Info, iconClassName: "text-blue-500" },
  debug: { variant: "outline", icon: Bug, iconClassName: "text-purple-500" },
}

const getLogLevel = (level: string) => logLevels[level.toLowerCase()]

type LogLevelProps = {
  level: string
  className?: string
}

export function LogLevelIcon({ level, className, ...props }: LogLevelProps & Omit<LucideProps, "ref">) {
  const logLevel = getLogLevel(level)
  if (!logLevel) return <div className={cn("size-4", className)} />

  const { icon: Icon, iconClassName } = logLevel
  return <Icon className={cn("size-4", iconClassName, className)} aria-hidden {...props} />
}

export function LogLevelBadge({ level, className }: LogLevelProps) {
  const logLevel = getLogLevel(level)

  return (
    <Badge variant={logLevel?.variant ?? "outline"} className={cn("uppercase", className)}>
      {logLevel && <LogLevelIcon level={level} data-icon="inline-start" />}
      {level}
    </Badge>
  )
}
