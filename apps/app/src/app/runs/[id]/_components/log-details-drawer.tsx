"use client";

import type { jobRunsTable } from "@better-bull-board/db";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Bug,
  CalendarClock,
  Clock,
  Info,
} from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";
import { cn } from "~/lib/utils/client";

interface LogEntry {
  id: string;
  jobRunId: string;
  level: string;
  message: string;
  ts: number;
}

interface LogDetailsDrawerProps {
  log: LogEntry;
  run: typeof jobRunsTable.$inferSelect;
  onBack: () => void;
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

const DetailItem = ({
  icon,
  label,
  value,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  className?: string;
}) => (
  <div className={cn("flex items-center space-x-3", className)}>
    <div className="flex-shrink-0">{icon}</div>
    <div className="flex-1 min-w-0">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  </div>
);

export function LogDetailsDrawer({ log, run, onBack }: LogDetailsDrawerProps) {
  const logDate = new Date(log.ts);
  const startTime = run.enqueuedAt?.getTime() ?? 0;
  const relativeTime = log.ts - startTime;

  return (
    <Card className="h-[calc(100vh-12rem)] overflow-hidden">
      <CardHeader>
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="p-1 h-8 w-8"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <CardTitle className="flex items-center space-x-2">
            {getLevelIcon(log.level)}
            <span>Log Details</span>
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="h-full pb-6 overflow-hidden">
        <div className="space-y-6 overflow-y-auto overflow-x-hidden h-full">
          {/* Log Level */}
          <div>
            <h3 className="text-sm font-medium mb-3">Level</h3>
            <Badge className={getLevelColor(log.level)}>
              {log.level.toUpperCase()}
            </Badge>
          </div>

          <Separator />

          {/* Basic Info */}
          <div>
            <h3 className="text-sm font-medium mb-3">Basic Information</h3>
            <div className="space-y-3">
              <DetailItem
                icon={
                  <CalendarClock className="h-4 w-4 text-muted-foreground" />
                }
                label="Timestamp"
                value={logDate.toISOString()}
              />
              <DetailItem
                icon={<Clock className="h-4 w-4 text-muted-foreground" />}
                label="Relative Time"
                value={`${relativeTime}ms after start`}
              />
              <DetailItem
                icon={<AlertCircle className="h-4 w-4 text-muted-foreground" />}
                label="Log ID"
                value={
                  <span className="font-mono text-xs break-all">{log.id}</span>
                }
              />
            </div>
          </div>

          <Separator />

          {/* Message */}
          <div>
            <h3 className="text-sm font-medium mb-3">Message</h3>
            <div className="p-2 bg-muted/30 rounded border">
              <pre className="text-xs font-mono whitespace-pre-wrap break-words">
                {log.message}
              </pre>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
