"use client";

import { useQuery } from "@tanstack/react-query";
import { formatDistanceStrict, formatDistanceToNow } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { useQueryStates, parseAsString } from "nuqs";
import { useState, useMemo, useEffect } from "react";
import { getJobsTableApiRoute } from "~/app/api/jobs/table/schemas";
import { Badge } from "~/components/ui/badge";
import { Checkbox } from "~/components/ui/checkbox";
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
import { BulkActions } from "./bulk-actions";
import { RunActions } from "./run-actions";
import { RunsFilters } from "./runs-filters";
import type { TRunFilters } from "./types";

export function RunsTable() {
  const [urlFilters, setUrlFilters] = useQueryStates({
    queue: parseAsString.withDefault("all"),
    status: parseAsString.withDefault("all"),
    search: parseAsString.withDefault(""),
  });

  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set());

  const filters: TRunFilters = {
    ...urlFilters,
    cursor: null,
    limit: 15,
  };
  const debouncedFilters = useDebounce(filters, 300);

  const { data: runs } = useQuery({
    queryKey: ["jobs/table", debouncedFilters],
    queryFn: apiFetch({
      apiRoute: getJobsTableApiRoute,
      body: debouncedFilters,
    }),
  });

  const jobs = runs?.jobs || [];
  
  // Clear selection when filters change
  useEffect(() => {
    setSelectedJobIds(new Set());
  }, [debouncedFilters]);
  
  const selectedJobs = useMemo(() => {
    return jobs.filter(job => selectedJobIds.has(job.job_id));
  }, [jobs, selectedJobIds]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedJobIds(new Set(jobs.map(job => job.job_id)));
    } else {
      setSelectedJobIds(new Set());
    }
  };

  const handleSelectJob = (jobId: string, checked: boolean) => {
    const newSelection = new Set(selectedJobIds);
    if (checked) {
      newSelection.add(jobId);
    } else {
      newSelection.delete(jobId);
    }
    setSelectedJobIds(newSelection);
  };

  const isAllSelected = jobs.length > 0 && selectedJobIds.size === jobs.length;
  const isPartiallySelected = selectedJobIds.size > 0 && selectedJobIds.size < jobs.length;

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
      <RunsFilters filters={filters} setFilters={setUrlFilters} />
      
      {selectedJobs.length > 0 && (
        <BulkActions 
          selectedJobs={selectedJobs} 
          onClearSelection={() => setSelectedJobIds(new Set())}
        />
      )}
      
      <Table className="table-fixed w-full">
        <TableHeader>
          <TableRow>
            <TableHead style={{ width: "50px" }}>
              <Checkbox
                checked={isAllSelected}
                indeterminate={isPartiallySelected}
                onCheckedChange={handleSelectAll}
                aria-label="Select all jobs"
              />
            </TableHead>
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
            {jobs.map((run) => (
              <motion.tr
                key={run.id}
                className={cn(
                  "group border-b transition-colors hover:bg-muted/50",
                  selectedJobIds.has(run.job_id) && "bg-blue-50 dark:bg-blue-950"
                )}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                layout
              >
                <TableCell>
                  <Checkbox
                    checked={selectedJobIds.has(run.job_id)}
                    onCheckedChange={(checked) => 
                      handleSelectJob(run.job_id, checked as boolean)
                    }
                    aria-label={`Select job ${run.job_id}`}
                  />
                </TableCell>
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
    </div>
  );
}
