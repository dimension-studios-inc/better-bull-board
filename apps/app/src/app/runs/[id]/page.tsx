"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { PageContainer } from "~/components/page-container";
import { PageTitle } from "~/components/page-title";
import { apiFetch } from "~/lib/utils/client";
import { getJobByIdApiRoute } from "~/app/api/jobs/[id]/schemas";
import { getJobLogsApiRoute } from "~/app/api/jobs/logs/schemas";
import { RunDetailsDrawer } from "./_components/run-details-drawer";
import { LogsWaterfall } from "./_components/logs-waterfall";
import { Skeleton } from "~/components/ui/skeleton";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { AlertCircle } from "lucide-react";

export default function RunViewPage() {
  const params = useParams();
  const runId = params.id as string;

  const { data: run, isLoading: isLoadingRun, error: runError } = useQuery({
    queryKey: ["jobs/single", runId],
    queryFn: apiFetch({
      apiRoute: getJobByIdApiRoute,
      routeParams: { id: runId },
    }),
    enabled: !!runId,
  });

  const { data: logsData, isLoading: isLoadingLogs, error: logsError } = useQuery({
    queryKey: ["jobs/logs", runId],
    queryFn: apiFetch({
      apiRoute: getJobLogsApiRoute,
      body: { jobRunId: runId, limit: 1000 },
    }),
    enabled: !!runId,
  });

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
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load run details. The run might not exist or there was an error loading it.
          </AlertDescription>
        </Alert>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageTitle
        title={`Run ${run.job_id}`}
        description={`${run.queue} • ${run.status}`}
      />
      
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <LogsWaterfall 
            logs={logsData?.logs || []} 
            isLoading={isLoadingLogs}
            error={logsError}
          />
        </div>
        <div className="lg:col-span-1">
          <RunDetailsDrawer run={run} />
        </div>
      </div>
    </PageContainer>
  );
}