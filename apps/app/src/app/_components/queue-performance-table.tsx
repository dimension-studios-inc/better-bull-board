"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { z } from "zod";
import type { dashboardQueuePerformanceOutput } from "~/app/api/dashboard/summary/schemas";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Skeleton } from "~/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { TruncatedTooltip } from "~/components/ui/truncated-tooltip";

type QueuePerformance = z.output<typeof dashboardQueuePerformanceOutput>;

interface QueuePerformanceTableProps {
  queuePerformance: QueuePerformance[] | undefined;
  isLoading: boolean;
}

type SortKey = keyof Pick<
  QueuePerformance,
  "queue" | "totalRuns" | "successes" | "failures" | "errorRate" | "avgDuration" | "minDuration" | "maxDuration"
>;
type SortDirection = "asc" | "desc";

const sortableColumns: { key: SortKey; label: string; align?: "right" }[] = [
  { key: "queue", label: "Queue" },
  { key: "totalRuns", label: "Total Runs", align: "right" },
  { key: "successes", label: "Success", align: "right" },
  { key: "failures", label: "Failed", align: "right" },
  { key: "errorRate", label: "Error Rate", align: "right" },
  { key: "avgDuration", label: "Avg Duration", align: "right" },
  { key: "minDuration", label: "Min Duration", align: "right" },
  { key: "maxDuration", label: "Max Duration", align: "right" },
];

export function QueuePerformanceTable({ queuePerformance, isLoading }: QueuePerformanceTableProps) {
  const router = useRouter();
  const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection }>({
    key: "totalRuns",
    direction: "desc",
  });

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    if (seconds < 3600) return `${(seconds / 60).toFixed(1)}m`;
    return `${(seconds / 3600).toFixed(1)}h`;
  };

  const sortedQueuePerformance = useMemo(() => {
    return [...(queuePerformance ?? [])].sort((a, b) => {
      const direction = sort.direction === "asc" ? 1 : -1;
      const aValue = a[sort.key];
      const bValue = b[sort.key];

      if (typeof aValue === "string" && typeof bValue === "string") {
        return aValue.localeCompare(bValue) * direction;
      }

      return (Number(aValue) - Number(bValue)) * direction;
    });
  }, [queuePerformance, sort]);

  const handleSort = (key: SortKey) => {
    setSort((current) => ({
      key,
      direction: current.key === key && current.direction === "desc" ? "asc" : "desc",
    }));
  };

  const handleQueueClick = (queue: string) => {
    router.push(`/runs?queue=${encodeURIComponent(queue)}`);
  };

  const getSortIcon = (key: SortKey) => {
    if (sort.key !== key) return <ArrowUpDown className="size-3.5 text-muted-foreground" />;
    if (sort.direction === "asc") return <ArrowUp className="size-3.5" />;
    return <ArrowDown className="size-3.5" />;
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
              <TableHeader className="z-10">
                <TableRow>
                  {sortableColumns.map((column) => (
                    <TableHead key={column.key} className={column.align === "right" ? "text-right" : undefined}>
                      <button
                        type="button"
                        className={
                          column.align === "right"
                            ? "ml-auto flex items-center gap-1 font-medium"
                            : "flex items-center gap-1 font-medium"
                        }
                        onClick={() => handleSort(column.key)}
                      >
                        {column.label}
                        {getSortIcon(column.key)}
                      </button>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedQueuePerformance.map((queue) => (
                  <TableRow
                    key={queue.queue}
                    className="cursor-pointer transition-colors hover:bg-muted/50 focus-visible:bg-muted/50"
                    tabIndex={0}
                    onClick={() => handleQueueClick(queue.queue)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        handleQueueClick(queue.queue);
                      }
                    }}
                  >
                    <TableCell className="max-w-48 font-medium">
                      <TruncatedTooltip value={queue.queue} />
                    </TableCell>
                    <TableCell className="text-right font-mono">{queue.totalRuns.toLocaleString()}</TableCell>
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
                    <TableCell className="text-right font-mono">{formatDuration(queue.avgDuration)}</TableCell>
                    <TableCell className="text-right font-mono">{formatDuration(queue.minDuration)}</TableCell>
                    <TableCell className="text-right font-mono">{formatDuration(queue.maxDuration)}</TableCell>
                  </TableRow>
                ))}
                {!sortedQueuePerformance.length && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
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
