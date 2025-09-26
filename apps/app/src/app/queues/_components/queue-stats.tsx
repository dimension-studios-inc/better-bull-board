"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity, Clock, Server } from "lucide-react";
import { getQueuesStatsApiRoute } from "~/app/api/queues/stats/schemas";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { apiFetch } from "~/lib/utils";

export function QueueStats() {
  const { data: queues, isLoading } = useQuery({
    queryKey: ["queues/stats"],
    queryFn: apiFetch({ apiRoute: getQueuesStatsApiRoute, body: undefined }),
  });

  const totalQueues = queues?.total;
  const activeQueues = queues?.active;
  const schedulerQueues = queues?.withScheduler;

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
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <Card key={stat.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {stat.title}
            </CardTitle>
            <stat.icon className={`h-4 w-4 ${stat.color}`} />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton />
            ) : (
              <div className="text-2xl font-bold">{stat.value}</div>
            )}
            <p className="text-xs text-muted-foreground">{stat.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
