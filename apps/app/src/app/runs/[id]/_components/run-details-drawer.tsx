"use client";

import type { jobRunsTable } from "@better-bull-board/db";
import {
  AlertCircle,
  CalendarClock,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  CircleQuestionMarkIcon,
  Clock,
  Database,
  Hash,
  Loader,
  PlayCircle,
  Settings,
  Tag,
  User,
} from "lucide-react";
import { useEffect, useState } from "react";
import { codeToHtml } from "shiki";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible";
import { Separator } from "~/components/ui/separator";
import { cn, smartFormatDuration } from "~/lib/utils/client";

interface RunDetailsDrawerProps {
  run: typeof jobRunsTable.$inferSelect;
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case "completed":
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case "failed":
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    case "active":
      return <Loader className="h-4 w-4 text-blue-500 animate-spin" />;
    case "waiting":
      return <Clock className="h-4 w-4 text-yellow-500" />;
    default:
      return <CircleQuestionMarkIcon className="h-4 w-4 text-gray-500" />;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case "completed":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
    case "failed":
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
    case "active":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
    case "waiting":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
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
    <div className="shrink-0">{icon}</div>
    <div className="flex-1 min-w-0">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  </div>
);

const JsonCollapsible = ({ title, data, icon }: { title: string; data: unknown; icon: React.ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [formattedData, setFormattedData] = useState<string>("");

  useEffect(() => {
    const formatMessage = async () => {
      try {
        const html = await codeToHtml(JSON.stringify(data, null, 2), {
          lang: "json",
          theme: "vitesse-light",
        });
        setFormattedData(html);
      } catch (error) {
        console.error("Failed to format message:", error);
        setFormattedData(JSON.stringify(data, null, 2));
      }
    };

    formatMessage();
  }, [data]);

  if (!data) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center space-x-2 w-full text-left hover:bg-muted/50 p-2 rounded">
        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        {icon}
        <span className="text-sm font-medium">{title}</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2">
        <div
          className="text-xs p-3 rounded border overflow-auto"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: Shiki generates safe HTML
          dangerouslySetInnerHTML={{ __html: formattedData }}
        />
      </CollapsibleContent>
    </Collapsible>
  );
};

export function RunDetailsDrawer({ run }: RunDetailsDrawerProps) {
  const duration =
    run.startedAt && run.finishedAt && (run.status === "completed" || run.status === "failed")
      ? smartFormatDuration(run.finishedAt.getTime() - run.startedAt.getTime())
      : null;

  return (
    <Card className="h-[calc(100vh-12rem)]">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          {getStatusIcon(run.status)}
          <span>Run Details</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="h-full pb-6 overflow-hidden">
        <div className="space-y-6 overflow-y-auto overflow-x-hidden h-full">
          {/* Status */}
          <div>
            <h3 className="text-sm font-medium mb-3">Status</h3>
            <Badge className={getStatusColor(run.status)}>{run.status.toUpperCase()}</Badge>
          </div>

          <Separator />

          {/* Basic Info */}
          <div>
            <h3 className="text-sm font-medium mb-3">Basic Information</h3>
            <div className="space-y-3">
              <DetailItem
                icon={<Hash className="h-4 w-4 text-muted-foreground" />}
                label="Job ID"
                value={<span className="font-mono text-xs break-all">{run.jobId}</span>}
              />
              <DetailItem
                icon={<Database className="h-4 w-4 text-muted-foreground" />}
                label="Queue"
                value={run.queue}
              />
              {run.name && (
                <DetailItem icon={<Tag className="h-4 w-4 text-muted-foreground" />} label="Name" value={run.name} />
              )}
              {run.workerId && (
                <DetailItem
                  icon={<User className="h-4 w-4 text-muted-foreground" />}
                  label="Worker ID"
                  value={<span className="font-mono text-xs">{run.workerId}</span>}
                />
              )}
            </div>
          </div>

          <Separator />

          {/* Timing */}
          <div>
            <h3 className="text-sm font-medium mb-3">Timing</h3>
            <div className="space-y-3">
              <DetailItem
                icon={<CalendarClock className="h-4 w-4 text-muted-foreground" />}
                label="Created"
                value={new Date(run.createdAt).toISOString()}
              />
              {run.enqueuedAt && (
                <DetailItem
                  icon={<PlayCircle className="h-4 w-4 text-muted-foreground" />}
                  label="Enqueued"
                  value={new Date(run.enqueuedAt).toISOString()}
                />
              )}
              {run.startedAt && (
                <DetailItem
                  icon={<PlayCircle className="h-4 w-4 text-muted-foreground" />}
                  label="Started"
                  value={new Date(run.startedAt).toISOString()}
                />
              )}
              {run.finishedAt && (
                <DetailItem
                  icon={<CheckCircle className="h-4 w-4 text-muted-foreground" />}
                  label="Finished"
                  value={new Date(run.finishedAt).toISOString()}
                />
              )}
              {duration && (
                <DetailItem
                  icon={<Clock className="h-4 w-4 text-muted-foreground" />}
                  label="Duration"
                  value={duration}
                />
              )}
            </div>
          </div>

          {/* Execution Details */}
          {(run.maxAttempts !== 0 || run.priority !== null || run.delayMs > 0) && (
            <>
              <Separator />
              <div>
                <h3 className="text-sm font-medium mb-3">Execution</h3>
                <div className="space-y-3">
                  {run.maxAttempts !== 0 && (
                    <DetailItem
                      icon={<Settings className="h-4 w-4 text-muted-foreground" />}
                      label="Attempt"
                      value={`${run.attempt} / ${run.maxAttempts}`}
                    />
                  )}
                  {run.priority !== null && (
                    <DetailItem
                      icon={<Settings className="h-4 w-4 text-muted-foreground" />}
                      label="Priority"
                      value={run.priority}
                    />
                  )}
                  {run.delayMs > 0 && (
                    <DetailItem
                      icon={<Clock className="h-4 w-4 text-muted-foreground" />}
                      label="Delay"
                      value={smartFormatDuration(run.delayMs)}
                    />
                  )}
                </div>
              </div>
            </>
          )}

          {/* Tags */}
          {run.tags && run.tags.length > 0 && (
            <>
              <Separator />
              <div>
                <h3 className="text-sm font-medium mb-3">Tags</h3>
                <div className="flex flex-wrap gap-1">
                  {run.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Error Details */}
          {run.status === "failed" && (run.errorMessage || run.errorStack) && (
            <>
              <Separator />
              <div>
                <h3 className="text-sm font-medium mb-3 text-red-600">Error Details</h3>
                {run.errorMessage && (
                  <div className="mb-3">
                    <div className="text-xs text-muted-foreground mb-1">Message</div>
                    <div className="p-2 bg-red-50 border border-red-200 rounded text-sm dark:bg-red-950/30 dark:border-red-800">
                      {run.errorMessage}
                    </div>
                  </div>
                )}
                {run.errorStack && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Stack Trace</div>
                    <div className="p-2 bg-red-50 border border-red-200 rounded text-xs font-mono dark:bg-red-950/30 dark:border-red-800 max-h-32 overflow-y-auto">
                      <pre className="whitespace-pre-wrap wrap-break-word">{run.errorStack}</pre>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          <Separator />

          {/* Data & Result */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Payloads</h3>
            <JsonCollapsible
              title="Input Data"
              data={run.data}
              icon={<Database className="h-4 w-4 text-muted-foreground" />}
            />
            <JsonCollapsible
              title="Result"
              data={run.result}
              icon={<CheckCircle className="h-4 w-4 text-muted-foreground" />}
            />
            <JsonCollapsible
              title="Backoff Config"
              data={run.backoff}
              icon={<Settings className="h-4 w-4 text-muted-foreground" />}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
