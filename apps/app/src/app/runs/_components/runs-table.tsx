"use client";

import { useQuery } from "@tanstack/react-query";
import { formatDistanceStrict, formatDistanceToNow } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { parseAsString, useQueryStates } from "nuqs";
import { useEffect, useMemo, useState } from "react";
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
  const router = useRouter();
  const [urlFilters, setUrlFilters] = useQueryStates({
    queue: parseAsString.withDefault("all"),
    status: parseAsString.withDefault("all"),
    search: parseAsString.withDefault(""),
    tags: parseAsString.withDefault(""),
    cursor: parseAsString.withDefault(""),
  });

  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set());

  const filters: TRunFilters = useMemo(
    () => ({
      ...urlFilters,
      tags: urlFilters.tags ? urlFilters.tags.split(",").filter(Boolean) : [],
      cursor:
        JSON.parse(
          Buffer.from(urlFilters.cursor, "base64").toString("utf-8") || "null",
        ) ?? null,
      limit: 15,
    }),
    [urlFilters],
  );

  const debouncedFilters = useDebounce(filters, 300);

  const { data: runs } = useQuery({
    queryKey: ["jobs/table", debouncedFilters],
    queryFn: apiFetch({
      apiRoute: getJobsTableApiRoute,
      body: debouncedFilters,
    }),
  });

  const handleFiltersChange = (
    newFilters: Partial<
      Pick<TRunFilters, "queue" | "status" | "search" | "tags" | "cursor">
    >,
  ) => {
    const urlUpdate: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(newFilters)) {
      if (key === "tags" && Array.isArray(value)) {
        urlUpdate[key] = value.length > 0 ? value.join(",") : "";
      } else if (key === "cursor") {
        urlUpdate[key] = Buffer.from(JSON.stringify(value || null)).toString(
          "base64",
        );
      } else {
        urlUpdate[key] = value;
      }
    }

    setUrlFilters(urlUpdate);
  };

  const jobs = runs?.jobs || [];

  // biome-ignore lint/correctness/useExhaustiveDependencies: Clear selection when filters change
  useEffect(() => {
    setSelectedJobIds(new Set());
  }, [debouncedFilters]);

  const selectedJobs = useMemo(() => {
    return jobs.filter((job) => selectedJobIds.has(job.job_id));
  }, [jobs, selectedJobIds]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedJobIds(new Set(jobs.map((job) => job.job_id)));
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
  const isPartiallySelected =
    selectedJobIds.size > 0 && selectedJobIds.size < jobs.length;

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

  const handleRowClick = (runId: string) => {
    router.push(`/runs/${runId}`);
  };

  return (
    <div className="space-y-4">
      <RunsFilters
        filters={filters}
        setFilters={handleFiltersChange}
        runs={runs}
        startEndContent={
          selectedJobs.length > 0 && (
            <BulkActions
              selectedJobs={selectedJobs}
              onClearSelection={() => setSelectedJobIds(new Set())}
            />
          )
        }
      />
      <div className="relative overflow-hidden rounded-lg border">
        <Table className="table-fixed w-full">
          <TableHeader className="z-10">
            <TableRow>
              <TableHead style={{ width: "50px" }}>
                <div className="flex items-center">
                  <Checkbox
                    checked={isAllSelected}
                    indeterminate={isPartiallySelected}
                    onCheckedChange={handleSelectAll}
                    aria-label="Select all jobs"
                  />
                </div>
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
            {jobs.map((run) => (
              <AnimatePresence key={`${run.id}-${run.updated_at.getTime()}`}>
                <motion.tr
                  key={run.id}
                  className={cn(
                    "group border-b transition-colors hover:bg-muted/50 cursor-pointer",
                    selectedJobIds.has(run.job_id) &&
                      "bg-blue-50 dark:bg-blue-950",
                  )}
                  initial={{ opacity: 0, y: -100 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                  layoutId={run.id}
                  onClick={() => handleRowClick(run.id)}
                >
                  <TableCell>
                    <div className="flex items-center">
                      <Checkbox
                        checked={selectedJobIds.has(run.job_id)}
                        onCheckedChange={(checked) =>
                          handleSelectJob(run.job_id, checked as boolean)
                        }
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                        aria-label={`Select job ${run.job_id}`}
                      />
                    </div>
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
                  <TableCell className="truncate">
                    {formatDistanceToNow(new Date(run.created_at), {
                      addSuffix: true,
                    })}
                  </TableCell>
                  <TableCell className="truncate">
                    {run.finished_at
                      ? formatDistanceToNow(new Date(run.finished_at), {
                          addSuffix: true,
                        })
                      : "-"}
                  </TableCell>
                  <TableCell
                    className={cn("max-w-48 truncate text-xs", {
                      "text-red-600":
                        run.status === "failed" && run.error_message,
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
              </AnimatePresence>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
