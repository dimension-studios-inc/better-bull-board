"use client"

import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@better-bull-board/ui/components/card"
import { Skeleton } from "@better-bull-board/ui/components/skeleton"
import { cn } from "cn"
import { Activity, AlertCircle, CheckCircle, ChevronRight, Gauge, type LucideIcon, Timer } from "lucide-react"
import Link from "next/link"
import type { z } from "zod"
import type { queueSummaryStatsOutput } from "~/app/api/queues/summary/schemas"
import { getRunsHref } from "~/lib/utils/runs-link"
import { formatDurationMs } from "./format-duration"

interface QueueSummaryCardsProps {
  queueName: string
  /** Period for the runs links, `null` while hydrating so the links match the server render */
  minutes: number | null
  periodLabel: string
  stats: z.output<typeof queueSummaryStatsOutput> | undefined
  isLoading: boolean
}

type StatCard = {
  title: string
  value: string | undefined
  icon: LucideIcon
  description: string
  color: string
  href?: string
}

const formatDurationValue = (ms: number | null | undefined) => (ms == null ? "-" : formatDurationMs(ms))

function StatCards({ cards, isLoading, className }: { cards: StatCard[]; isLoading: boolean; className: string }) {
  return (
    <div className={cn("grid grid-cols-1 gap-4", className)}>
      {cards.map((card) => (
        <Card key={card.title} className="relative">
          <CardHeader>
            <CardDescription>{card.title}</CardDescription>
            <CardTitle>{isLoading ? <Skeleton className="h-8 w-24" /> : (card.value ?? "-")}</CardTitle>
            <CardAction>
              <card.icon className={cn("size-4", card.color)} />
            </CardAction>
          </CardHeader>
          <CardFooter>
            {card.href ? (
              <Link
                href={card.href}
                aria-label={`View ${card.title.toLowerCase()} runs`}
                className="flex items-center gap-1 after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
              >
                {card.description}
                <ChevronRight className="size-4" />
              </Link>
            ) : (
              card.description
            )}
          </CardFooter>
        </Card>
      ))}
    </div>
  )
}

export function QueueSummaryCards({ queueName, minutes, periodLabel, stats, isLoading }: QueueSummaryCardsProps) {
  const period = periodLabel.toLowerCase()

  const runCards: StatCard[] = [
    {
      title: "Total Runs",
      value: stats?.totalRuns.toLocaleString(),
      icon: Activity,
      description: `Created (${period})`,
      color: "text-blue-600",
      href: getRunsHref({ queue: queueName, minutes }),
    },
    {
      title: "Successes",
      value: stats?.successes.toLocaleString(),
      icon: CheckCircle,
      description: `Completed (${period})`,
      color: "text-green-600",
      href: getRunsHref({ queue: queueName, status: "completed", minutes }),
    },
    {
      title: "Failures",
      value: stats?.failures.toLocaleString(),
      icon: AlertCircle,
      description: `Failed (${period})`,
      color: "text-red-600",
      href: getRunsHref({ queue: queueName, status: "failed", minutes }),
    },
    {
      title: "Error Rate",
      value: stats ? `${stats.errorRate.toFixed(1)}%` : undefined,
      icon: Gauge,
      description: "Failed out of all runs",
      color: "text-yellow-600",
    },
  ]

  const durationCards: StatCard[] = [
    { title: "p50 Duration", value: formatDurationValue(stats?.p50DurationMs), description: "Median" },
    { title: "p95 Duration", value: formatDurationValue(stats?.p95DurationMs), description: "95th percentile" },
    { title: "p99 Duration", value: formatDurationValue(stats?.p99DurationMs), description: "99th percentile" },
  ].map((card) => ({
    ...card,
    icon: Timer,
    description: `${card.description} of completed runs`,
    color: "text-purple-600",
  }))

  return (
    <>
      <StatCards cards={runCards} isLoading={isLoading} className="@xl/main:grid-cols-2 @5xl/main:grid-cols-4" />
      <StatCards cards={durationCards} isLoading={isLoading} className="@xl/main:grid-cols-3" />
    </>
  )
}
