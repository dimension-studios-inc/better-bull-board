"use client";

import { formatDistanceToNow } from "date-fns";
import { AlertCircle, AlertTriangle, Bug, Info } from "lucide-react";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/lib/utils/client";

interface LogEntry {
  id: string;
  job_run_id: string;
  level: string;
  message: string;
  ts: number;
}

interface LogsWaterfallProps {
  logs: LogEntry[];
  isLoading: boolean;
  error: Error | null;
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

export function LogsWaterfall({ logs, isLoading, error }: LogsWaterfallProps) {
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Logs</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to load logs. There was an error retrieving the log data.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Logs</CardTitle>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>
    );
  }

  if (!logs || logs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Logs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No logs found for this run
          </div>
        </CardContent>
      </Card>
    );
  }

  // Sort logs by timestamp ascending to show chronological order
  const sortedLogs = [...logs].sort((a, b) => a.ts - b.ts);

  return (
    <Card className="h-[calc(100vh-12rem)]">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Logs</span>
          <Badge variant="outline">{logs.length} entries</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="h-full pb-6">
        <ScrollArea className="h-full">
          <div className="space-y-4">
            {sortedLogs.map((log, index) => {
              const isLast = index === sortedLogs.length - 1;

              return (
                <div key={log.id} className="relative">
                  {/* Timeline line */}
                  {!isLast && (
                    <div className="absolute left-2 top-8 w-px h-8 bg-border" />
                  )}

                  <div className="flex items-start space-x-3">
                    {/* Timeline dot */}
                    <div className="flex-shrink-0 mt-1">
                      {getLevelIcon(log.level)}
                    </div>

                    {/* Log content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <Badge
                          className={getLevelColor(log.level)}
                          variant="outline"
                        >
                          {log.level.toUpperCase()}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(log.ts), {
                            addSuffix: true,
                          })}
                        </span>
                      </div>

                      <div
                        className={cn(
                          "p-3 rounded-lg border bg-card text-sm font-mono",
                          log.level.toLowerCase() === "error" &&
                            "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30",
                          log.level.toLowerCase() === "warn" &&
                            "border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/30",
                        )}
                      >
                        <pre className="whitespace-pre-wrap break-words">
                          {log.message}
                        </pre>
                      </div>
                    </div>

                    {/* Timestamp */}
                    <div className="flex-shrink-0 text-xs text-muted-foreground mt-1">
                      {new Date(log.ts).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
