import { Badge } from "@better-bull-board/ui/components/badge"
import { cn } from "cn"

// The one palette of run statuses: errors elsewhere use the destructive token, statuses need a color each
const statusClassNames: Record<string, string> = {
  completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  failed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  active: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  waiting: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  delayed: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
  prioritized: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
  "waiting-children": "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
}

const unknownStatusClassName = "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300"

type RunStatusBadgeProps = {
  status: string
  className?: string
}

export function RunStatusBadge({ status, className }: RunStatusBadgeProps) {
  return <Badge className={cn(statusClassNames[status] ?? unknownStatusClassName, className)}>{status}</Badge>
}
