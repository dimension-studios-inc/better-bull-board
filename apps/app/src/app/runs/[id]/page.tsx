"use client"

import { Alert, AlertDescription } from "@better-bull-board/ui/components/alert"
import { Drawer, DrawerContent } from "@better-bull-board/ui/components/drawer"
import { Skeleton } from "@better-bull-board/ui/components/skeleton"
import { useIsMobile } from "@better-bull-board/ui/hooks/use-mobile"
import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { cn } from "cn"
import { AlertCircle } from "lucide-react"
import { useParams } from "next/navigation"
import { parseAsString, useQueryState } from "nuqs"
import { useState } from "react"

import { getJobByIdApiRoute } from "~/app/api/jobs/[id]/schemas"
import { getJobLogsApiRoute } from "~/app/api/jobs/logs/schemas"
import { PageContainer } from "~/components/page-container"
import { apiFetch } from "~/lib/utils/client"

import { LogDetailsSelection } from "./_components/log-details-selection"
import { LogsWaterfall } from "./_components/logs-waterfall"
import { RunDetailsDrawer } from "./_components/run-details-drawer"
import { RunSummaryBar } from "./_components/run-summary-bar"

export default function RunViewPage() {
  const params = useParams()
  const runId = params.id as string
  const [selectedLogId, setSelectedLogId] = useQueryState("log", parseAsString)
  // Open on arrival, then closable at any time: the toggle, the run or a log brings it back
  const [isDetailsOpen, setIsDetailsOpen] = useState(true)
  const isMobile = useIsMobile()

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

  if (isLoadingRun) {
    return (
      <PageContainer>
        <Skeleton className="h-96 w-full" />
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
  const isRunShown = isDetailsOpen && !selectedLogId

  return (
    <PageContainer>
      {/* The desktop drawer doesn't block the page: keep the logs clear of it */}
      <div className={cn("flex flex-col gap-2", isDetailsOpen && !isMobile && "lg:pr-96")}>
        {/* Picking what the drawer already shows closes it, like the toggle.
            The margin lines it up with the logs, which keep clear of their scrollbar */}
        <RunSummaryBar
          className="mr-4"
          run={job}
          isRunShown={isRunShown}
          isDetailsOpen={isDetailsOpen}
          onRunClick={() => {
            void setSelectedLogId(null)
            setIsDetailsOpen(!isRunShown)
          }}
          onToggleDetails={() => setIsDetailsOpen((open) => !open)}
        />
        <LogsWaterfall
          logs={logsData}
          isLoading={isLoadingLogs}
          error={logsError}
          run={job}
          now={Math.max(runUpdatedAt, logsUpdatedAt)}
          shownLogId={isDetailsOpen ? selectedLogId : null}
          onLogClick={(log) => {
            void setSelectedLogId(log.id)
            setIsDetailsOpen(!(isDetailsOpen && selectedLogId === log.id))
          }}
          hasMore={hasNextPage}
          onLoadMore={() => void fetchNextPage()}
        />
      </div>
      {/* A bottom sheet over the logs on mobile, a side panel next to them on desktop */}
      <Drawer
        open={isDetailsOpen}
        onOpenChange={setIsDetailsOpen}
        swipeDirection={isMobile ? "down" : "right"}
        modal={isMobile}
        disablePointerDismissal={!isMobile}
        showSwipeHandle={isMobile}
      >
        <DrawerContent>
          {selectedLogId ? (
            <LogDetailsSelection
              logId={selectedLogId}
              loadedLog={loadedLog}
              isLoadingLogs={isLoadingLogs}
              runId={runId}
              run={job}
              onBack={() => void setSelectedLogId(null)}
            />
          ) : (
            <RunDetailsDrawer run={job} />
          )}
        </DrawerContent>
      </Drawer>
    </PageContainer>
  )
}
