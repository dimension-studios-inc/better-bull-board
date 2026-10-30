"use client"

import { Alert, AlertDescription } from "@better-bull-board/ui/components/alert"
import { Button } from "@better-bull-board/ui/components/button"
import { Skeleton } from "@better-bull-board/ui/components/skeleton"
import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { AlertCircle } from "lucide-react"
import { useParams } from "next/navigation"
import { parseAsString, useQueryState } from "nuqs"
import { useEffect, useRef } from "react"

import { getJobByIdApiRoute } from "~/app/api/jobs/[id]/schemas"
import { getJobLogsApiRoute } from "~/app/api/jobs/logs/schemas"
import { getJobLogApiRoute } from "~/app/api/jobs/logs/single/schemas"
import { PageContainer } from "~/components/page-container"
import { apiFetch } from "~/lib/utils/client"

import { LogDetailsDrawer } from "./_components/log-details-drawer"
import { LogsWaterfall } from "./_components/logs-waterfall"
import { RunDetailsDrawer } from "./_components/run-details-drawer"

export default function RunViewPage() {
  const params = useParams()
  const runId = params.id as string
  const [selectedLogId, setSelectedLogId] = useQueryState(
    "log",
    parseAsString.withOptions({ history: "push" }),
  )
  const detailsRef = useRef<HTMLDivElement>(null)

  // On stacked (mobile) layouts the details panel sits below the logs, so bring it into view
  useEffect(() => {
    if (selectedLogId && window.matchMedia("(max-width: 1023px)").matches) {
      detailsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }, [selectedLogId])

  const {
    data: run,
    dataUpdatedAt: runUpdatedAt,
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
  })

  const {
    data: logsDataPages,
    dataUpdatedAt: logsUpdatedAt,
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
        return lastPageParam + 100
      }
      return undefined
    },
  })

  const logsData = logsDataPages?.pages.flatMap((page) => page.logs) ?? []
  const loadedLog = logsData.find((log) => log.id === selectedLogId)
  const {
    data: linkedLog,
    isLoading: isLoadingLinkedLog,
    error: linkedLogError,
  } = useQuery({
    queryKey: ["jobs/log", runId, selectedLogId],
    queryFn: apiFetch({
      apiRoute: getJobLogApiRoute,
      body: { runId, logId: selectedLogId ?? "" },
    }),
    enabled: !!selectedLogId && !loadedLog,
  })
  const selectedLog = loadedLog ?? linkedLog?.log

  if (isLoadingRun) {
    return (
      <PageContainer>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          <div className="lg:col-span-3">
            <Skeleton className="h-96 w-full" />
          </div>
          <div className="lg:col-span-1">
            <Skeleton className="h-96 w-full" />
          </div>
        </div>
      </PageContainer>
    )
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
    )
  }

  const job = {
    ...run.job,
    createdAt: new Date(run.job.createdAt),
    enqueuedAt: run.job.enqueuedAt ? new Date(run.job.enqueuedAt) : null,
    startedAt: run.job.startedAt ? new Date(run.job.startedAt) : null,
    finishedAt: run.job.finishedAt ? new Date(run.job.finishedAt) : null,
  }
  return (
    <PageContainer>
      <div className="flex flex-col gap-4 lg:flex-row lg:gap-2">
        <div className="min-w-0 flex-1">
          <LogsWaterfall
            logs={logsData}
            isLoading={isLoadingLogs}
            error={logsError}
            run={job}
            now={Math.max(runUpdatedAt, logsUpdatedAt)}
            onLogClick={(log) => void setSelectedLogId(log.id)}
            hasMore={hasNextPage}
            onLoadMore={() => void fetchNextPage()}
          />
        </div>
        <div ref={detailsRef} className="w-full scroll-mt-4 lg:w-96 lg:shrink-0">
          {selectedLog ? (
            <LogDetailsDrawer
              log={selectedLog}
              run={job}
              onBack={() => void setSelectedLogId(null, { history: "replace" })}
            />
          ) : selectedLogId && (isLoadingLinkedLog || isLoadingLogs) ? (
            <Skeleton className="h-96 w-full" />
          ) : selectedLogId ? (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>
                {linkedLogError
                  ? "Failed to load log details."
                  : "This log was not found in the run."}
              </AlertDescription>
              <Button
                variant="outline"
                onClick={() => void setSelectedLogId(null, { history: "replace" })}
              >
                Back to run
              </Button>
            </Alert>
          ) : (
            <RunDetailsDrawer run={job} />
          )}
        </div>
      </div>
    </PageContainer>
  )
}
