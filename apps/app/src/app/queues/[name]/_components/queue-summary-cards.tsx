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
import {
  Activity,
  AlertCircle,
  CheckCircle,
  ChevronRight,
  Gauge,
  type LucideIcon,
  Timer,
} from "lucide-react"
import Link from "next/link"
import type { z } from "zod"

import type { queueSummaryStatsOutput } from "~/app/api/queues/summary/schemas"
import { formatDurationMs } from "~/lib/utils/duration"
import { getRunsHref } from "~/lib/utils/runs-link"

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
  /** Title on phones, where cards sit three in a row */
  shortTitle?: string
  value: string | undefined
  icon: LucideIcon
  description: string
  color: string
  href?: string
}

const formatDurationValue = (ms: number | null | undefined) =>
  ms == null ? "-" : formatDurationMs(ms)

// Compact cards side by side on phones, where the footer text would only push the charts down
function StatCards({
  cards,
  isLoading,
  className,
}: {
  cards: StatCard[]
  isLoading: boolean
  className: string
}) {
  return (
    <div className={cn("grid gap-3 sm:grid-cols-1 sm:gap-4", className)}>
      {cards.map((card) => (
        <Card key={card.title} className="relative">
          <CardHeader>
            <CardDescription>
              <span className="sm:hidden">{card.shortTitle ?? card.title}</span>
              <span className="max-sm:hidden">{card.title}</span>
            </CardDescription>
            <CardTitle>
              {isLoading ? <Skeleton className="h-6 w-16 sm:h-8 sm:w-24" /> : (card.value ?? "-")}
            </CardTitle>
            <CardAction>
              <card.icon className={cn("size-4", card.color)} />
            </CardAction>
          </CardHeader>
          <CardFooter className="max-sm:hidden">
            {card.href ? (
              <span className="flex items-center gap-1">
                {card.description}
                <ChevronRight className="size-4" />
              </span>
            ) : (
              card.description
            )}
          </CardFooter>
          {card.href && (
            <Link
              href={card.href}
              aria-label={`View ${card.title.toLowerCase()} runs`}
              className="absolute inset-0 rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            />
          )}
        </Card>
      ))}
    </div>
  )
}

export function QueueSummaryCards({
  queueName,
  minutes,
  periodLabel,
  stats,
  isLoading,
}: QueueSummaryCardsProps) {
  const period = periodLabel.toLowerCase()

  const runCards: StatCard[] = [
    {
      title: "Total Runs",
      value: stats?.totalRuns.toLocaleString(),
      icon: Activity,
      description: `Created (${period})`,
      color: "text-blue-600 dark:text-blue-400",
      href: getRunsHref({ queue: queueName, minutes }),
    },
    {
      title: "Successes",
      value: stats?.successes.toLocaleString(),
      icon: CheckCircle,
      description: `Completed (${period})`,
      color: "text-success",
      href: getRunsHref({ queue: queueName, status: "completed", minutes }),
    },
    {
      title: "Failures",
      value: stats?.failures.toLocaleString(),
      icon: AlertCircle,
      description: `Failed (${period})`,
      color: "text-destructive",
      href: getRunsHref({ queue: queueName, status: "failed", minutes }),
    },
    {
      title: "Error Rate",
      value: stats ? `${stats.errorRate.toFixed(1)}%` : undefined,
      icon: Gauge,
      description: "Failed out of all runs",
      color: "text-warning",
    },
  ]

  const durationCards: StatCard[] = [
    {
      title: "p50 Duration",
      shortTitle: "p50",
      value: formatDurationValue(stats?.p50DurationMs),
      description: "Median",
    },
    {
      title: "p95 Duration",
      shortTitle: "p95",
      value: formatDurationValue(stats?.p95DurationMs),
      description: "95th percentile",
    },
    {
      title: "p99 Duration",
      shortTitle: "p99",
      value: formatDurationValue(stats?.p99DurationMs),
      description: "99th percentile",
    },
  ].map((card) => ({
    ...card,
    icon: Timer,
    description: stats?.durationSampleLimit
      ? `${card.description} of the latest ${stats.durationSampleLimit.toLocaleString()} completed runs`
      : `${card.description} of completed runs`,
    color: "text-purple-600 dark:text-purple-400",
  }))

  return (
    <>
      <StatCards
        cards={runCards}
        isLoading={isLoading}
        className="grid-cols-2 @xl/main:grid-cols-2 @5xl/main:grid-cols-4"
      />
      <StatCards
        cards={durationCards}
        isLoading={isLoading}
        className="grid-cols-3 @xl/main:grid-cols-3"
      />
    </>
  )
}
