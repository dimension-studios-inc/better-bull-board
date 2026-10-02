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
import { useQuery } from "@tanstack/react-query"
import { cn } from "cn"
import { Activity, Clock, Server } from "lucide-react"
import { getQueuesStatsApiRoute } from "~/app/api/queues/stats/schemas"
import { apiFetch } from "~/lib/utils/client"

export function QueueStats() {
  const { data: queues, isLoading } = useQuery({
    queryKey: ["queues/stats"],
    queryFn: apiFetch({ apiRoute: getQueuesStatsApiRoute, body: undefined }),
  })

  const totalQueues = queues?.total
  const activeQueues = queues?.active
  const schedulerQueues = queues?.withScheduler

  const stats = [
    {
      title: "Total Queues",
      value: totalQueues,
      icon: Server,
      description: "Configured queues",
      color: "text-blue-600",
    },
    {
      title: "Active Queues",
      value: activeQueues,
      icon: Activity,
      description: "Currently running",
      color: "text-green-600",
    },
    {
      title: "With Scheduler",
      value: schedulerQueues,
      icon: Clock,
      description: "Have scheduled jobs",
      color: "text-purple-600",
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-3">
      {stats.map((stat) => (
        <Card key={stat.title}>
          <CardHeader>
            <CardDescription>{stat.title}</CardDescription>
            <CardTitle>
              {isLoading ? <Skeleton className="h-8 w-16" /> : (stat.value?.toLocaleString() ?? "-")}
            </CardTitle>
            <CardAction>
              <stat.icon className={cn("size-4", stat.color)} />
            </CardAction>
          </CardHeader>
          <CardFooter>{stat.description}</CardFooter>
        </Card>
      ))}
    </div>
  )
}
