"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity, AlertCircle, CheckCircle, Clock } from "lucide-react";
import Link from "next/link";
import { getEnhancedStatsApiRoute } from "~/app/api/dashboard/enhanced-stats/schemas";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { apiFetch, cn } from "~/lib/utils/client";

interface EnhancedStatsCardsProps {
  days: number;
}

export function EnhancedStatsCards({ days }: EnhancedStatsCardsProps) {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard/enhanced-stats", days],
    queryFn: apiFetch({
      apiRoute: getEnhancedStatsApiRoute,
      body: { days },
    }),
  });

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
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <Link
          key={card.title}
          href={card.href}
          aria-label={`View ${card.title.toLowerCase()} runs`}
          className="block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Card className="h-full cursor-pointer transition-colors hover:bg-muted/50">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              <card.icon className={cn("size-4", card.color)} />
            </CardHeader>
            <CardContent className="space-y-1">
              {isLoading ? (
                <Skeleton className="h-8 w-full" />
              ) : (
                <div className="text-2xl font-bold font-mono">{card.value?.toLocaleString()}</div>
              )}
              <p className="text-xs text-muted-foreground">{card.description}</p>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
