"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity, AlertCircle, CheckCircle } from "lucide-react";
import { getJobsStatsApiRoute } from "~/app/api/jobs/stats/schemas";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { apiFetch } from "~/lib/utils";
import { Skeleton } from "../../components/ui/skeleton";

export function StatsCards() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["jobs/stats"],
    queryFn: apiFetch({ apiRoute: getJobsStatsApiRoute, body: { days: 24 } }),
  });

  const cards = [
    {
      title: "Active",
      value: stats?.active,
      icon: Activity,
      description: "Jobs in queue",
      color: "text-blue-600",
    },
    {
      title: "Failed (24h)",
      value: stats?.failed,
      icon: AlertCircle,
      description: "Failed in last 24 hours",
      color: "text-red-600",
    },
    {
      title: "Completed (24h)",
      value: stats?.completed,
      icon: CheckCircle,
      description: "Completed in last 24 hours",
      color: "text-green-600",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
            <card.icon className={`h-4 w-4 ${card.color}`} />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton />
            ) : (
              <div className="text-2xl font-bold">
                {card.value?.toLocaleString()}
              </div>
            )}
            <p className="text-xs text-muted-foreground">{card.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
