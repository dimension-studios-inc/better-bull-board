"use client"

import { cn } from "cn"
import { Activity, AlertCircle, CheckCircle, ChevronRight, Clock } from "lucide-react"
import Link from "next/link"
import type { z } from "zod"
import type { dashboardEnhancedStatsOutput } from "~/app/api/dashboard/summary/schemas"
import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from "~/components/ui/card"
import { Skeleton } from "~/components/ui/skeleton"

interface EnhancedStatsCardsProps {
  days: number
  stats: z.output<typeof dashboardEnhancedStatsOutput> | undefined
  isLoading: boolean
}

export function EnhancedStatsCards({ days, stats, isLoading }: EnhancedStatsCardsProps) {
  const cards = [
    {
      title: "Running Tasks",
      value: stats?.runningTasks,
      icon: Activity,
      description: "Currently executing",
      color: "text-blue-600",
      href: "/runs?status=active",
    },
    {
      title: "Waiting in Queue",
      value: stats?.waitingInQueue,
      icon: Clock,
      description: "Queued for execution",
      color: "text-yellow-600",
      href: "/runs?status=waiting",
    },
    {
      title: "Successes",
      value: stats?.successes,
      icon: CheckCircle,
      description: `Completed in last ${days} day${days > 1 ? "s" : ""}`,
      color: "text-green-600",
      href: "/runs?status=completed",
    },
    {
      title: "Failures",
      value: stats?.failures,
      icon: AlertCircle,
      description: `Failed in last ${days} day${days > 1 ? "s" : ""}`,
      color: "text-red-600",
      href: "/runs?status=failed",
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card">
      {cards.map((card) => (
        <Card key={card.title} className="@container/card relative transition-colors hover:border-foreground/20">
          <CardHeader>
            <CardDescription>{card.title}</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {isLoading ? <Skeleton className="h-8 w-24" /> : (card.value?.toLocaleString() ?? "-")}
            </CardTitle>
            <CardAction>
              <card.icon className={cn("size-4", card.color)} />
            </CardAction>
          </CardHeader>
          <CardFooter className="text-sm text-muted-foreground">
            <Link
              href={card.href}
              aria-label={`View ${card.title.toLowerCase()} runs`}
              className="flex items-center gap-1 after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
            >
              {card.description}
              <ChevronRight className="size-4" />
            </Link>
          </CardFooter>
        </Card>
      ))}
    </div>
  )
}
