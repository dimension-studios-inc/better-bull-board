"use client";

import { useQuery } from "@tanstack/react-query";
import { formatDistanceStrict, formatDistanceToNow } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useQueryStates, parseAsString } from "nuqs";
import { useState } from "react";
import { getJobsTableApiRoute } from "~/app/api/jobs/table/schemas";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import useDebounce from "~/hooks/use-debounce";
import { apiFetch, cn } from "~/lib/utils/client";
import { RunActions } from "./run-actions";
import { RunsFilters } from "./runs-filters";
import type { TRunFilters } from "./types";

export function RunsTable() {
  const [urlFilters, setUrlFilters] = useQueryStates({
    queue: parseAsString.withDefault("all"),
    status: parseAsString.withDefault("all"),
    search: parseAsString.withDefault(""),
  });

  const [cursor, setCursor] = useState<string | null>(null);
  const [direction, setDirection] = useState<'next' | 'prev'>('next');
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);

  const filters: TRunFilters = {
    ...urlFilters,
    cursor,
    direction,
    limit: 15,
  };
  const debouncedFilters = useDebounce(filters, 300);

  const { data: runs, isLoading } = useQuery({
    queryKey: ["jobs/table", debouncedFilters],
    queryFn: apiFetch({
      apiRoute: getJobsTableApiRoute,
      body: debouncedFilters,
    }),
  });

  const handleNextPage = () => {
    if (runs?.nextCursor) {
      setCursorHistory(prev => cursor ? [...prev, cursor] : prev);
      setCursor(runs.nextCursor);
      setDirection('next');
    }
  };

  const handlePrevPage = () => {
    if (cursorHistory.length > 0) {
      const previousCursor = cursorHistory[cursorHistory.length - 1];
      setCursorHistory(prev => prev.slice(0, -1));
      setCursor(previousCursor || null);
      setDirection('next');
    } else if (runs?.prevCursor) {
      setCursor(runs.prevCursor);
      setDirection('prev');
    }
  };

  const handleFiltersChange = (newFilters: any) => {
    // Reset pagination when filters change
    setCursor(null);
    setDirection('next');
    setCursorHistory([]);
    setUrlFilters(newFilters);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "failed":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
      case "active":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      // case "waiting":
      //   return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
      // case "delayed":
      //   return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
    }
  };

  return (
    <div className="space-y-4">
      <RunsFilters filters={filters} setFilters={handleFiltersChange} />
      <Table className="table-fixed w-full">
        <TableHeader>
          <TableRow>
            <TableHead style={{ width: "260px" }}>Job ID</TableHead>
            <TableHead style={{ width: "120px" }}>Queue</TableHead>
            <TableHead style={{ width: "180px" }}>Tags</TableHead>
            <TableHead style={{ width: "120px" }}>Status</TableHead>
            <TableHead style={{ width: "120px" }}>Duration</TableHead>
            <TableHead style={{ width: "140px" }}>Created</TableHead>
            <TableHead style={{ width: "140px" }}>Finished</TableHead>
            <TableHead style={{ width: "140px" }}>Error</TableHead>
            <TableHead style={{ width: "90px" }}>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <AnimatePresence mode="popLayout">
            {runs?.jobs.map((run) => (
              <motion.tr
                key={run.id}
                className="group border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                layout
              >
                <TableCell className="font-mono text-xs">
                  {run.job_id.slice(0, 32)}
                  {run.job_id.length > 32 && "..."}
                </TableCell>
                <TableCell>{run.queue}</TableCell>
                <TableCell className="overflow-hidden">
                  {run.tags?.map((tag) => (
                    <Badge key={tag} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                </TableCell>
                <TableCell>
                  <Badge className={getStatusColor(run.status)}>
                    {run.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {run.started_at &&
                  run.finished_at &&
                  (run.status === "completed" || run.status === "failed")
                    ? formatDistanceStrict(run.started_at, run.finished_at)
                    : "-"}
                </TableCell>
                <TableCell className="text-xs truncate">
                  {formatDistanceToNow(new Date(run.created_at), {
                    addSuffix: true,
                  })}
                </TableCell>
                <TableCell className="text-xs truncate">
                  {run.finished_at
                    ? formatDistanceToNow(new Date(run.finished_at), {
                        addSuffix: true,
                      })
                    : "-"}
                </TableCell>
                <TableCell
                  className={cn("max-w-48 truncate text-xs", {
                    "text-red-600": run.status === "failed" && run.error_message,
                  })}
                >
                  {run.status === "failed" && run.error_message
                    ? run.error_message
                    : "-"}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <RunActions
                      jobId={run.job_id}
                      queueName={run.queue}
                      status={run.status}
                    />
                  </div>
                </TableCell>
              </motion.tr>
            ))}
          </AnimatePresence>
        </TableBody>
      </Table>
      
      {/* Pagination Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrevPage}
            disabled={isLoading || (cursorHistory.length === 0 && !runs?.prevCursor)}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleNextPage}
            disabled={isLoading || !runs?.nextCursor}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="text-sm text-muted-foreground">
          {runs?.jobs?.length && (
            <span>Showing {runs.jobs.length} results</span>
          )}
        </div>
      </div>
    </div>
  );
}
