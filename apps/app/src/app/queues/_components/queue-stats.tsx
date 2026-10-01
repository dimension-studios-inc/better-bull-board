"use client"

import { useQuery } from "@tanstack/react-query"
import { Activity, Clock, Server } from "lucide-react"
import { getQueuesStatsApiRoute } from "~/app/api/queues/stats/schemas"
import { Badge } from "~/components/ui/badge"
import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from "~/components/ui/card"
import { Skeleton } from "~/components/ui/skeleton"
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
    <div className="grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs @xl/main:grid-cols-3 dark:*:data-[slot=card]:bg-card">
      {stats.map((stat) => (
        <Card key={stat.title} className="@container/card">
          <CardHeader>
            <CardDescription>{stat.title}</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {isLoading ? <Skeleton className="h-8 w-16" /> : (stat.value?.toLocaleString() ?? "-")}
            </CardTitle>
            <CardAction>
              <Badge variant="outline">
                <stat.icon className={stat.color} />
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="text-sm text-muted-foreground">{stat.description}</CardFooter>
        </Card>
      ))}
    </div>
  )
}
