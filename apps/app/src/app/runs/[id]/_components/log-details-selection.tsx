"use client"

import { getJobLogInputSchema, type JobLogEntry } from "@better-bull-board/core/job-schemas"
import type { jobRunsTable } from "@better-bull-board/db"
import { Alert, AlertDescription } from "@better-bull-board/ui/components/alert"
import { Skeleton } from "@better-bull-board/ui/components/skeleton"
import { useQuery } from "@tanstack/react-query"
import { AlertCircle } from "lucide-react"

import { getJobLogApiRoute } from "~/app/api/jobs/logs/single/schemas"
import { apiFetch } from "~/lib/utils/client"

import { DetailsDrawerBody } from "./details-drawer"
import { LogDetailsDrawer, LogDetailsDrawerHeader } from "./log-details-drawer"

interface LogDetailsSelectionProps {
  logId: string
  loadedLog?: JobLogEntry
  isLoadingLogs: boolean
  runId: string
  run: typeof jobRunsTable.$inferSelect
  onBack: () => void
}

export function LogDetailsSelection({
  logId,
  loadedLog,
  isLoadingLogs,
  runId,
  run,
  onBack,
}: LogDetailsSelectionProps) {
  const validLogId = getJobLogInputSchema.safeParse({ runId, logId }).success
  const { data, isLoading, error } = useQuery({
    queryKey: ["jobs/log", runId, logId],
    queryFn: apiFetch({
      apiRoute: getJobLogApiRoute,
      body: { runId, logId },
    }),
    enabled: validLogId && !loadedLog && !isLoadingLogs,
  })
  const log = loadedLog ?? data?.log

  if (log) return <LogDetailsDrawer log={log} run={run} onBack={onBack} />

  return (
    <>
      <LogDetailsDrawerHeader onBack={onBack} />
      <DetailsDrawerBody>
        {validLogId && (isLoading || isLoadingLogs) ? (
          <Skeleton className="h-96 w-full" />
        ) : (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>
              {error ? "Failed to load log details." : "This log was not found in the run."}
            </AlertDescription>
          </Alert>
        )}
      </DetailsDrawerBody>
    </>
  )
}
