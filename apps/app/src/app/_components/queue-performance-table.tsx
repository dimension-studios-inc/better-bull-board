"use client";

import { useQuery } from "@tanstack/react-query";
import { getQueuePerformanceApiRoute } from "~/app/api/dashboard/queue-performance/schemas";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { apiFetch } from "~/lib/utils/client";

interface QueuePerformanceTableProps {
  days: number;
}

export function QueuePerformanceTable({ days }: QueuePerformanceTableProps) {
  const { data: queuePerformance, isLoading } = useQuery({
    queryKey: ["dashboard/queue-performance", days],
    queryFn: apiFetch({
      apiRoute: getQueuePerformanceApiRoute,
      body: { days },
    }),
  });

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    if (seconds < 3600) return `${(seconds / 60).toFixed(1)}m`;
    return `${(seconds / 3600).toFixed(1)}h`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Queue Performance Summary</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3 h-96">
            {Array.from({ length: 5 }).map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: skeleton
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <ScrollArea className="h-96">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Queue</TableHead>
                  <TableHead className="text-right">Total Runs</TableHead>
                  <TableHead className="text-right">Success</TableHead>
                  <TableHead className="text-right">Failed</TableHead>
                  <TableHead className="text-right">Error Rate</TableHead>
                  <TableHead className="text-right">Avg Duration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {queuePerformance?.map((queue) => (
                  <TableRow key={queue.queue}>
                    <TableCell
                      className="font-medium max-w-48 truncate"
                      title={queue.queue}
                    >
                      {queue.queue}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {queue.totalRuns.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-mono text-green-600">
                      {queue.successes.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-mono text-red-600">
                      {queue.failures.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      <span
                        className={
                          queue.errorRate > 10
                            ? "text-red-600"
                            : queue.errorRate > 5
                              ? "text-yellow-600"
                              : "text-green-600"
                        }
                      >
                        {queue.errorRate.toFixed(1)}%
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatDuration(queue.avgDuration)}
                    </TableCell>
                  </TableRow>
                ))}
                {!queuePerformance?.length && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-muted-foreground"
                    >
                      No data available for the selected period
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
