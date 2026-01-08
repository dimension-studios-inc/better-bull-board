"use client";

import type { jobRunsTable } from "@better-bull-board/db";
import { AlertCircle, AlertTriangle, Bug, Info } from "lucide-react";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Loader } from "~/components/ui/loader";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { useInfiniteScroll } from "~/hooks/use-infinite-scroll";
import { cn, smartFormatDuration } from "~/lib/utils/client";

interface LogEntry {
  id: string;
  jobRunId: string;
  level: string;
  message: string;
  ts: number;
}

interface LogsWaterfallProps {
  logs: LogEntry[];
  isLoading: boolean;
  error: Error | null;
  run: typeof jobRunsTable.$inferSelect;
  onLogClick?: (log: LogEntry) => void;
  hasMore: boolean;
  onLoadMore: () => void;
}

const getLevelIcon = (level: string) => {
  switch (level.toLowerCase()) {
    case "error":
      return <AlertCircle className="size-4 text-red-500" />;
    case "warn":
    case "warning":
      return <AlertTriangle className="size-4 text-yellow-500" />;
    case "debug":
      return <Bug className="size-4 text-purple-500" />;
    case "info":
      return <Info className="size-4 text-blue-500" />;
    default:
      return <div className="size-4" />;
  }
};

const getLevelColor = (level: string) => {
  switch (level.toLowerCase()) {
    case "error":
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
    case "warn":
    case "warning":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
    case "debug":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
    case "info":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
  }
};

const getWaterfallColor = (level: string) => {
  switch (level.toLowerCase()) {
    case "error":
      return "bg-red-500";
    case "warn":
    case "warning":
      return "bg-yellow-500";
    case "debug":
      return "bg-purple-500";
    case "info":
      return "bg-blue-500";
    default:
      return "bg-gray-500";
  }
};

export function LogsWaterfall({
  logs,
  isLoading,
  error,
  run,
  onLogClick,
  hasMore,
  onLoadMore,
}: LogsWaterfallProps) {
  const { loaderRef: logsLoaderRef } = useInfiniteScroll({
    fetchNextPage: onLoadMore,
    hasNextPage: hasMore,
    isFetchingNextPage: isLoading,
  });

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load logs. There was an error retrieving the log data.
        </AlertDescription>
      </Alert>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: this is a loading state
          <div key={i} className="flex items-start space-x-3">
            <Skeleton className="h-4 w-4 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-full" />
            </div>
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    );
  }

  if (!logs || logs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No logs found for this run
      </div>
    );
  }

  // Sort logs by timestamp ascending to show chronological order
  const sortedLogs = [...logs].sort((a, b) => a.ts - b.ts);

  const scheduledTime =
    (run.enqueuedAt?.getTime() ?? run.createdAt.getTime()) + run.delayMs;
  const startTime = Math.max(run.createdAt.getTime(), scheduledTime);
  const endTime = run.finishedAt ? run.finishedAt.getTime() : Date.now();
  const totalDuration = endTime - startTime;

  return (
    <ScrollArea className="h-[calc(100vh-12rem)] pr-4">
      {/* Waterfall header with time markers */}
      <div className="grid grid-cols-12 gap-4 mb-4 pb-2 border-b">
        <div className="col-span-6">
          <span className="text-sm font-medium text-muted-foreground">
            Log Details
          </span>
        </div>
        <div className="col-span-6">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0ms</span>
            <span>Timeline</span>
            <span>{smartFormatDuration(totalDuration)}</span>
          </div>
        </div>
      </div>

      <div className="">
        {sortedLogs.map((log) => {
          const relativeTime = log.ts - startTime;
          const position =
            totalDuration > 0 ? (relativeTime / totalDuration) * 100 : 0;

          return (
            <div
              key={log.id}
              className={cn(
                "grid grid-cols-12 items-start",
                "hover:bg-gray-50 hover:dark:bg-gray-950/30",
                onLogClick && "cursor-pointer",
                {
                  "hover:bg-red-50 hover:dark:bg-red-950/30":
                    log.level.toLowerCase() === "error",
                  "hover:bg-yellow-50 hover:dark:bg-yellow-950/30":
                    log.level.toLowerCase() === "warn",
                  "hover:bg-purple-50 hover:dark:bg-purple-950/30":
                    log.level.toLowerCase() === "debug",
                  "hover:bg-blue-50 hover:dark:bg-blue-950/30":
                    log.level.toLowerCase() === "info",
                },
              )}
              onClick={() => onLogClick?.(log)}
            >
              <div
                className={cn(
                  "col-span-6 flex items-center space-x-3 p-2 rounded font-mono",
                )}
              >
                {/* Timeline dot */}
                <Tooltip>
                  <TooltipTrigger>
                    <div className="shrink-0">{getLevelIcon(log.level)}</div>
                  </TooltipTrigger>
                  <TooltipContent className="bg-none p-0 m-0" withoutArrow>
                    <Badge
                      className={getLevelColor(log.level)}
                      variant="outline"
                    >
                      {log.level.toUpperCase()}
                    </Badge>
                  </TooltipContent>
                </Tooltip>

                {/* Log content */}
                <div className="flex-1 min-w-0">
                  <pre className="truncate text-xs">{log.message}</pre>
                </div>
              </div>
              <div className="col-span-6 flex items-center h-full border-l border-muted-foreground/20">
                <div className="size-full items-center flex">
                  {/* Waterfall bar */}
                  <div
                    className={cn(
                      "w-2 h-3 shrink-0 rounded-sm flex items-center justify-center",
                      getWaterfallColor(log.level),
                    )}
                    style={{
                      marginLeft: `${position}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {hasMore && (
        <div
          className="flex items-center justify-center"
          ref={logsLoaderRef as React.Ref<HTMLDivElement>}
        >
          <Loader />
        </div>
      )}
    </ScrollArea>
  );
}
