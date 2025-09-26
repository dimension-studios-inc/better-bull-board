"use client";

import { useQuery } from "@tanstack/react-query";
import { formatDuration } from "date-fns";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { getQueuesTableApiRoute } from "~/app/api/queues/table/schemas";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { apiFetch, cn } from "~/lib/utils";
import { QueueActions } from "./queue-actions";
import { type TimePeriod, TimePeriodSelector } from "./time-period-selector";

export function QueuesTable() {
  const router = useRouter();
  const [options, setOptions] = useState<{
    cursor: string | null;
    search: string;
    timePeriod: TimePeriod;
  }>({
    cursor: null,
    search: "",
    timePeriod: "1",
  });

  const handleQueueClick = (queueName: string) => {
    router.push(`/runs?queue=${encodeURIComponent(queueName)}`);
  };

  const { data } = useQuery({
    queryKey: ["queues/table", options],
    queryFn: apiFetch({
      apiRoute: getQueuesTableApiRoute,
      body: {
        cursor: options.cursor,
        search: options.search,
        timePeriod: options.timePeriod,
        limit: 20,
      },
    }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <TimePeriodSelector
          value={options.timePeriod}
          onChange={(timePeriod) =>
            setOptions((prev) => ({ ...prev, timePeriod }))
          }
        />
        <div className="flex-1 relative max-w-[350px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by queue name..."
            value={options.search}
            onChange={(e) =>
              setOptions((prev) => ({ ...prev, search: e.target.value }))
            }
            className="pl-10"
          />
        </div>
      </div>
      <Table className="table-fixed w-full">
        <TableHeader>
          <TableRow>
            <TableHead style={{ width: "260px" }}>Queue Name</TableHead>
            <TableHead style={{ width: "120px" }}>Status</TableHead>
            <TableHead style={{ width: "120px" }}>Scheduler</TableHead>
            <TableHead style={{ width: "120px" }}>Active Jobs</TableHead>
            <TableHead style={{ width: "120px" }}>Failed Jobs</TableHead>
            <TableHead style={{ width: "120px" }}>Completed Jobs</TableHead>
            <TableHead style={{ width: "60px" }}></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data?.queues.map((queue) => (
            <TableRow 
              key={queue.name}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => handleQueueClick(queue.name)}
            >
              <TableCell className="font-medium">{queue.name}</TableCell>
              <TableCell>
                <Badge
                  variant={"outline"}
                  className={cn({
                    "opacity-50": queue.isPaused,
                  })}
                >
                  {queue.isPaused ? "Paused" : "Running"}
                </Badge>
              </TableCell>
              <TableCell>
                <span className="font-mono">
                  {queue.pattern ||
                    (queue.every &&
                      `Every ${formatDuration({
                        seconds: queue.every / 1000,
                      })}`)}
                </span>
              </TableCell>
              <TableCell>
                <span className="font-mono">{queue.activeJobs}</span>
              </TableCell>
              <TableCell>
                <span className="font-mono text-red-600">
                  {queue.failedJobs}
                </span>
              </TableCell>
              <TableCell>
                <span className="font-mono text-green-600">
                  {queue.completedJobs}
                </span>
              </TableCell>
              <TableCell onClick={(e) => e.stopPropagation()}>
                <QueueActions
                  queueName={queue.name}
                  isPaused={queue.isPaused}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
