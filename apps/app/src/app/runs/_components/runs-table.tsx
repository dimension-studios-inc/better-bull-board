"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceStrict, formatDistanceToNowStrict } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { createParser, parseAsString, useQueryStates } from "nuqs";
import { useMemo, useRef, useState } from "react";
import { getJobsTableApiRoute } from "~/app/api/jobs/table/schemas";
import { Badge } from "~/components/ui/badge";
import { Checkbox } from "~/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";
import { TruncatedTooltip } from "~/components/ui/truncated-tooltip";
import useDebounce from "~/hooks/use-debounce";
import { apiFetch, cn } from "~/lib/utils/client";
import { BulkActions } from "./bulk-actions";
import { RunActions } from "./run-actions";
import { RunsFilters } from "./runs-filters";
import type { TRunFilters, TRunFilterUpdate } from "./types";

const parseAsCursor = createParser<NonNullable<TRunFilters["cursor"]>>({
  parse: (value) => {
    try {
      return JSON.parse(Buffer.from(value, "base64").toString("utf-8"));
    } catch {
      return null;
    }
  },
  serialize: (value) => Buffer.from(JSON.stringify(value)).toString("base64"),
});

const formatUtcTimestamp = (value: Date) => `${value.toISOString().slice(0, 19).replace("T", " ")} UTC`;

const formatRunTimestamp = (value: Date) => ({
  absolute: formatUtcTimestamp(value),
  relative: formatDistanceToNowStrict(value, { addSuffix: true }),
});

type RunTimestampProps = {
  value: Date;
};

function RunTimestamp({ value }: RunTimestampProps) {
  const timestamp = formatRunTimestamp(value);

  return (
    <time dateTime={value.toISOString()} title={timestamp.absolute}>
      <span className="block truncate">{timestamp.relative}</span>
      <span className="block truncate text-xs text-muted-foreground">{timestamp.absolute}</span>
    </time>
  );
}

const isInteractiveRowTarget = (target: EventTarget | null) =>
  target instanceof Element && !!target.closest("a,button,input,select,textarea,[role='checkbox']");

const openRunInNewPage = (runPath: string) => {
  window.open(runPath, "_blank", "noopener,noreferrer");
};

const handleRowAuxClick = (event: React.MouseEvent<HTMLTableRowElement>, runPath: string) => {
  if (event.button !== 1 || isInteractiveRowTarget(event.target)) return;

  event.preventDefault();
  openRunInNewPage(runPath);
};

export function RunsTable() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [urlFilters, setUrlFilters] = useQueryStates({
    queue: parseAsString.withDefault("all"),
    status: parseAsString.withDefault("all"),
    search: parseAsString.withDefault(""),
    tags: parseAsString.withDefault(""),
    createdFrom: parseAsString.withDefault(""),
    createdTo: parseAsString.withDefault(""),
    sortBy: parseAsString.withDefault("createdAt"),
    sortDirection: parseAsString.withDefault("desc"),
    cursor: parseAsCursor,
    cursorDirection: parseAsString.withDefault("next"),
  });

  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set());
  const [liveUpdatesPaused, setLiveUpdatesPaused] = useState(false);
  const cursorHistoryRef = useRef<TRunFilters["cursor"][]>([]);
  const cursorCreatedAt = urlFilters.cursor?.createdAt;
  const cursorJobId = urlFilters.cursor?.jobId;
  const cursorId = urlFilters.cursor?.id;
  const cursorDurationMs = urlFilters.cursor?.durationMs;

  const filters: TRunFilters = useMemo(
    () => ({
      queue: urlFilters.queue,
      status: urlFilters.status,
      search: urlFilters.search,
      createdFrom: urlFilters.createdFrom,
      createdTo: urlFilters.createdTo,
      tags: urlFilters.tags ? urlFilters.tags.split(",").filter(Boolean) : [],
      sortBy: urlFilters.sortBy === "durationMs" ? "durationMs" : "createdAt",
      sortDirection: urlFilters.sortDirection === "asc" ? "asc" : "desc",
      cursor:
        cursorCreatedAt && cursorJobId && cursorId
          ? {
              createdAt: cursorCreatedAt,
              jobId: cursorJobId,
              id: cursorId,
              durationMs: cursorDurationMs,
            }
          : null,
      cursorDirection: urlFilters.cursorDirection === "prev" ? "prev" : "next",
      limit: 15,
    }),
    [
      urlFilters.queue,
      urlFilters.status,
      urlFilters.search,
      urlFilters.tags,
      urlFilters.createdFrom,
      urlFilters.createdTo,
      urlFilters.sortBy,
      urlFilters.sortDirection,
      cursorCreatedAt,
      cursorJobId,
      cursorId,
      cursorDurationMs,
      urlFilters.cursorDirection,
    ],
  );

  const debouncedFilters = useDebounce(filters, 300);
  const queryFilters = filters.cursor || filters.cursorDirection === "prev" ? filters : debouncedFilters;
  const liveQueryKey = useMemo(() => ["jobs/table", queryFilters] as const, [queryFilters]);

  const { data: runs, isFetching } = useQuery({
    queryKey: liveUpdatesPaused ? (["jobs/table-paused", queryFilters] as const) : liveQueryKey,
    queryFn: apiFetch({
      apiRoute: getJobsTableApiRoute,
      body: queryFilters,
    }),
    initialData: liveUpdatesPaused ? () => queryClient.getQueryData(liveQueryKey) : undefined,
    staleTime: liveUpdatesPaused ? Number.POSITIVE_INFINITY : undefined,
  });

  const handleFiltersChange = (newFilters: TRunFilterUpdate) => {
    const isPaginationOnly = Object.keys(newFilters).every((key) => key === "cursor" || key === "cursorDirection");
    const urlUpdate: Record<string, unknown> = isPaginationOnly ? {} : { cursor: null, cursorDirection: "next" };

    if (isPaginationOnly && newFilters.cursorDirection === "next") {
      cursorHistoryRef.current.push(filters.cursor);
    }

    if (isPaginationOnly && newFilters.cursorDirection === "prev") {
      const previousCursor = cursorHistoryRef.current.pop();

      if (previousCursor !== undefined) {
        newFilters = { cursor: previousCursor, cursorDirection: "next" };
      }
    }

    if (!isPaginationOnly) {
      cursorHistoryRef.current = [];
    }

    for (const [key, value] of Object.entries(newFilters)) {
      if (key === "tags" && Array.isArray(value)) {
        urlUpdate[key] = value.length > 0 ? value.join(",") : "";
      } else {
        urlUpdate[key] = value;
      }
    }

    setSelectedJobIds(new Set());
    setUrlFilters(urlUpdate);
  };

  const jobs = runs?.jobs || [];

  const selectedJobs = useMemo(() => {
    return jobs.filter((job) => selectedJobIds.has(job.jobId));
  }, [jobs, selectedJobIds]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedJobIds(new Set(jobs.map((job) => job.jobId)));
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
      case "waiting":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
      case "delayed":
      case "prioritized":
      case "waiting-children":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300";
      case "unknown":
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
    }
  };

  const handleRowClick = (event: React.MouseEvent<HTMLTableRowElement>, runPath: string) => {
    if (isInteractiveRowTarget(event.target)) return;

    if (event.metaKey || event.ctrlKey) {
      openRunInNewPage(runPath);
      return;
    }

    router.push(runPath);
  };

  const handleDurationSort = () => {
    handleFiltersChange({
      sortBy: "durationMs",
      sortDirection: filters.sortBy === "durationMs" && filters.sortDirection === "desc" ? "asc" : "desc",
    });
  };

  const getDurationSortIcon = () => {
    if (filters.sortBy !== "durationMs") return <ArrowUpDown className="size-3.5 text-muted-foreground" />;
    if (filters.sortDirection === "asc") return <ArrowUp className="size-3.5" />;
    return <ArrowDown className="size-3.5" />;
  };

  return (
    <div className="space-y-4">
      <RunsFilters
        filters={filters}
        setFilters={handleFiltersChange}
        runs={runs}
        isFetching={isFetching}
        liveUpdatesPaused={liveUpdatesPaused}
        onLiveUpdatesPausedChange={setLiveUpdatesPaused}
        startEndContent={
          selectedJobs.length > 0 && (
            <BulkActions selectedJobs={selectedJobs} onClearSelection={() => setSelectedJobIds(new Set())} />
          )
        }
      />
      <div className="relative overflow-y-scroll rounded-lg border">
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
              <TableHead style={{ width: "120px" }}>Job ID</TableHead>
              <TableHead style={{ width: "260px" }}>Queue</TableHead>
              <TableHead style={{ width: "180px" }}>Tags</TableHead>
              <TableHead style={{ width: "120px" }}>Status</TableHead>
              <TableHead style={{ width: "120px" }}>
                <button type="button" className="flex items-center gap-1 font-medium" onClick={handleDurationSort}>
                  Duration
                  {getDurationSortIcon()}
                </button>
              </TableHead>
              <TableHead style={{ width: "170px" }}>Created</TableHead>
              <TableHead style={{ width: "170px" }}>Finished</TableHead>
              <TableHead style={{ width: "140px" }}>Error</TableHead>
              <TableHead style={{ width: "90px" }}>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.map((run) => {
              const runPath = `/runs/${run.id}`;

              return (
                <AnimatePresence key={`${run.id}-${run.createdAt.getTime()}`}>
                  <motion.tr
                    key={run.id}
                    className={cn(
                      "group border-b transition-colors hover:bg-muted/50 cursor-pointer",
                      selectedJobIds.has(run.jobId) && "bg-blue-50 dark:bg-blue-950",
                    )}
                    initial={{ opacity: 0, y: -100 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    layoutId={run.id}
                    onClick={(event) => handleRowClick(event, runPath)}
                    onAuxClick={(event) => handleRowAuxClick(event, runPath)}
                  >
                    <TableCell>
                      <div className="flex items-center">
                        <Checkbox
                          checked={selectedJobIds.has(run.jobId)}
                          onCheckedChange={(checked) => handleSelectJob(run.jobId, checked as boolean)}
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                          aria-label={`Select job ${run.jobId}`}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      <TruncatedTooltip value={run.jobId} />
                    </TableCell>
                    <TableCell>
                      <TruncatedTooltip value={run.queue} />
                    </TableCell>
                    <TableCell className="overflow-hidden">
                      {run.tags?.map((tag) => (
                        <Badge key={tag} variant="outline">
                          {tag}
                        </Badge>
                      ))}
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(run.status)}>{run.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {run.startedAt && run.finishedAt && (run.status === "completed" || run.status === "failed")
                        ? formatDistanceStrict(run.startedAt, run.finishedAt)
                        : "-"}
                    </TableCell>
                    <TableCell className="truncate">
                      <RunTimestamp value={run.createdAt} />
                    </TableCell>
                    <TableCell className="truncate">
                      {run.finishedAt ? <RunTimestamp value={run.finishedAt} /> : "-"}
                    </TableCell>
                    <TableCell className="max-w-48">
                      {run.status === "failed" && run.errorMessage ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              className="block w-full truncate text-left font-mono text-xs text-red-600 underline decoration-red-400/40 decoration-dotted underline-offset-4 transition-colors hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 focus-visible:ring-offset-2 dark:text-red-400 dark:hover:text-red-300"
                            >
                              {run.errorMessage}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent
                            side="left"
                            align="start"
                            sideOffset={8}
                            withoutArrow
                            className="max-h-80 max-w-xl overflow-auto rounded-lg border border-red-500/20 bg-background p-0 text-foreground shadow-xl"
                          >
                            <div className="border-b border-red-500/10 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-300">
                              Error details
                            </div>
                            <pre className="whitespace-pre-wrap break-words p-3 font-mono text-xs leading-relaxed text-red-700 dark:text-red-300">
                              {run.errorMessage}
                            </pre>
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <RunActions jobId={run.jobId} queueName={run.queue} status={run.status} />
                      </div>
                    </TableCell>
                  </motion.tr>
                </AnimatePresence>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
