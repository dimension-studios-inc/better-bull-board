"use client"

import { cn } from "cn"
import { Activity, AlertCircle, CheckCircle, ChevronRight, Clock } from "lucide-react"
import Link from "next/link"
import type { z } from "zod"
import type { dashboardEnhancedStatsOutput } from "~/app/api/dashboard/summary/schemas"
import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from "~/components/ui/card"
import { Skeleton } from "~/components/ui/skeleton"

interface EnhancedStatsCardsProps {
  periodLabel: string
  stats: z.output<typeof dashboardEnhancedStatsOutput> | undefined
  isLoading: boolean
}

export function EnhancedStatsCards({ periodLabel, stats, isLoading }: EnhancedStatsCardsProps) {
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
      description: `Completed (${periodLabel.toLowerCase()})`,
      color: "text-green-600",
      href: "/runs?status=completed",
    },
    {
      title: "Failures",
      value: stats?.failures,
      icon: AlertCircle,
      description: `Failed (${periodLabel.toLowerCase()})`,
      color: "text-red-600",
      href: "/runs?status=failed",
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title} className="relative">
          <CardHeader>
            <CardDescription>{card.title}</CardDescription>
            <CardTitle>
              {isLoading ? <Skeleton className="h-8 w-24" /> : (card.value?.toLocaleString() ?? "-")}
            </CardTitle>
            <CardAction>
              <card.icon className={cn("size-4", card.color)} />
            </CardAction>
          </CardHeader>
          <CardFooter>
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
