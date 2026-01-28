"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { AlertCircle } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";
import { getJobByIdApiRoute } from "~/app/api/jobs/[id]/schemas";
import { getJobLogsApiRoute } from "~/app/api/jobs/logs/schemas";
import { PageContainer } from "~/components/page-container";
import { PageTitle } from "~/components/page-title";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Skeleton } from "~/components/ui/skeleton";
import { apiFetch } from "~/lib/utils/client";
import { LogDetailsDrawer } from "./_components/log-details-drawer";
import { LogsWaterfall } from "./_components/logs-waterfall";
import { RunDetailsDrawer } from "./_components/run-details-drawer";

interface LogEntry {
  id: string;
  jobRunId: string;
  level: string;
  message: string;
  ts: number;
}

export default function RunViewPage() {
  const params = useParams();
  const runId = params.id as string;
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);

  const {
    data: run,
    isLoading: isLoadingRun,
    error: runError,
  } = useQuery({
    queryKey: ["jobs/single", runId],
    queryFn: apiFetch({
      apiRoute: getJobByIdApiRoute,
      urlParams: { id: runId },
      body: undefined,
    }),
    enabled: !!runId,
  });

  const {
    data: logsDataPages,
    isLoading: isLoadingLogs,
    hasNextPage,
    fetchNextPage,
    error: logsError,
  } = useInfiniteQuery({
    queryKey: ["jobs/logs", runId],
    queryFn: ({ pageParam }: { pageParam: number | null }) =>
      apiFetch({
        apiRoute: getJobLogsApiRoute,
        body: { id: runId, limit: 100, offset: pageParam ?? 0 },
      })(),
    enabled: !!runId,
    initialPageParam: 0,
    getNextPageParam: (lastPage, _all, lastPageParam) => {
      if (lastPage.total > lastPageParam + 100) {
        return lastPageParam + 100;
      }
      return undefined;
    },
  });

  const logsData = logsDataPages?.pages.flatMap((page) => page.logs) || [];

  if (isLoadingRun) {
    return (
      <PageContainer>
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-3">
              <Skeleton className="h-96 w-full" />
            </div>
            <div className="lg:col-span-1">
              <Skeleton className="h-96 w-full" />
            </div>
          </div>
        </div>
      </PageContainer>
    );
  }

  if (runError || !run) {
    return (
      <PageContainer>
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>
            Failed to load run details. The run might not exist or there was an error loading it.
          </AlertDescription>
        </Alert>
      </PageContainer>
    );
  }

  const job = {
    ...run.job,
    createdAt: new Date(run.job.createdAt),
    enqueuedAt: run.job.enqueuedAt ? new Date(run.job.enqueuedAt) : null,
    startedAt: run.job.startedAt ? new Date(run.job.startedAt) : null,
    finishedAt: run.job.finishedAt ? new Date(run.job.finishedAt) : null,
  };
  return (
    <PageContainer>
      <PageTitle title={`Run ${run.job.jobId}`} description={`${run.job.queue} • ${run.job.status}`} withRunsLink />

      <div className="flex flex-row gap-2">
        <div className="flex-1">
          <LogsWaterfall
            logs={logsData}
            isLoading={isLoadingLogs}
            error={logsError}
            run={job}
            onLogClick={setSelectedLog}
            hasMore={hasNextPage}
            onLoadMore={() => fetchNextPage()}
          />
        </div>
        <div className="w-96">
          {selectedLog ? (
            <LogDetailsDrawer log={selectedLog} run={job} onBack={() => setSelectedLog(null)} />
          ) : (
            <RunDetailsDrawer run={job} />
          )}
        </div>
      </div>
    </PageContainer>
  );
}
