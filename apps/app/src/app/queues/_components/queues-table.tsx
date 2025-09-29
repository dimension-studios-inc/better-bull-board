"use client";

import { useQuery } from "@tanstack/react-query";
import { formatDuration } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { parseAsString, useQueryStates } from "nuqs";
import { getQueuesTableApiRoute } from "~/app/api/queues/table/schemas";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { apiFetch, cn } from "~/lib/utils/client";
import { QueueActions } from "./queue-actions";
import { QueueMiniChart } from "./queue-mini-chart";
import { type TimePeriod, TimePeriodSelector } from "./time-period-selector";

export function QueuesTable() {
  const router = useRouter();
  const [urlState, setUrlState] = useQueryStates({
    search: parseAsString.withDefault(""),
    timePeriod: parseAsString.withDefault("30"),
    cursor: parseAsString.withDefault(""),
  });

  const options = {
    cursor: urlState.cursor || null,
    search: urlState.search,
    timePeriod: urlState.timePeriod as TimePeriod,
  };

  const handleQueueClick = (queueName: string) => {
    router.push(`/runs?queue=${encodeURIComponent(queueName)}`);
  };

  const { data, isLoading } = useQuery({
    queryKey: ["queues/table", options],
    queryFn: apiFetch({
      apiRoute: getQueuesTableApiRoute,
      body: options,
    }),
  });

  const handleNextPage = () => {
    if (data?.nextCursor) {
      setUrlState({ cursor: data.nextCursor });
    }
  };

  const handlePrevPage = () => {
    if (data?.prevCursor) {
      setUrlState({ cursor: data.prevCursor });
    } else {
      setUrlState({ cursor: null });
    }
  };

  const handleSearchChange = (search: string) => {
    // Reset pagination when search changes
    setUrlState({ cursor: null, search });
  };

  const handleTimePeriodChange = (timePeriod: TimePeriod) => {
    // Reset pagination when time period changes
    setUrlState({ cursor: null, timePeriod });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <TimePeriodSelector
            value={options.timePeriod}
            onChange={handleTimePeriodChange}
          />
          <div className="flex-1 relative max-w-[350px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by queue name..."
              value={options.search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrevPage}
            disabled={isLoading || (!data?.prevCursor && !options.cursor)}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleNextPage}
            disabled={isLoading || !data?.nextCursor}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="relative overflow-hidden rounded-lg border">
        <Table className="table-fixed w-full">
          <TableHeader>
            <TableRow>
              <TableHead style={{ width: "200px" }}>Queue Name</TableHead>
              <TableHead style={{ width: "120px" }}>Status</TableHead>
              <TableHead style={{ width: "120px" }}>Scheduler</TableHead>
              <TableHead style={{ width: "120px" }}>Active Jobs</TableHead>
              <TableHead style={{ width: "120px" }}>Failed Jobs</TableHead>
              <TableHead style={{ width: "120px" }}>Completed Jobs</TableHead>
              <TableHead style={{ width: "70px" }}>Trend</TableHead>
              <TableHead style={{ width: "90px" }}></TableHead>
            </TableRow>
          </TableHeader>
        <TableBody>
          <AnimatePresence mode="wait">
            {data?.queues.map((queue) => (
              <motion.tr
                key={queue.name}
                className="group border-b transition-colors cursor-pointer hover:bg-muted/50 data-[state=selected]:bg-muted"
                onClick={() => handleQueueClick(queue.name)}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                layoutId={queue.name}
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
                  <span className="font-mono truncate block">
                    {queue.patterns.length
                      ? queue.patterns.join(", ")
                      : queue.everys.length
                        ? queue.everys.map(
                            (every) =>
                              `Every ${formatDuration({
                                seconds: Number(every) / 1000,
                              })}`,
                          )
                        : undefined}
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
                  <QueueMiniChart data={queue.chartData} />
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <QueueActions
                      queueName={queue.name}
                      isPaused={queue.isPaused}
                    />
                  </div>
                </TableCell>
              </motion.tr>
            ))}
          </AnimatePresence>
        </TableBody>
        </Table>
      </div>
    </div>
  );
}
