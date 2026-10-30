"use client"

import type { jobRunsTable } from "@better-bull-board/db"
import { Alert, AlertDescription } from "@better-bull-board/ui/components/alert"
import { Button } from "@better-bull-board/ui/components/button"
import { Skeleton } from "@better-bull-board/ui/components/skeleton"
import { useQuery } from "@tanstack/react-query"
import { AlertCircle } from "lucide-react"

import { getJobLogApiRoute } from "~/app/api/jobs/logs/single/schemas"
import { apiFetch } from "~/lib/utils/client"

import { LogDetailsDrawer } from "./log-details-drawer"

interface LogEntry {
  id: string
  jobRunId: string
  level: string
  message: string
  ts: number
}

interface LogDetailsSelectionProps {
  logId: string
  loadedLog?: LogEntry
  runId: string
  run: typeof jobRunsTable.$inferSelect
  onBack: () => void
}

export function LogDetailsSelection({
  logId,
  loadedLog,
  runId,
  run,
  onBack,
}: LogDetailsSelectionProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["jobs/log", runId, logId],
    queryFn: apiFetch({
      apiRoute: getJobLogApiRoute,
      body: { runId, logId },
    }),
    enabled: !loadedLog,
  })
  const log = loadedLog ?? data?.log

  if (log) return <LogDetailsDrawer log={log} run={run} onBack={onBack} />
  if (isLoading) return <Skeleton className="h-96 w-full" />

  return (
    <Alert variant="destructive">
      <AlertCircle className="size-4" />
      <AlertDescription>
        {error ? "Failed to load log details." : "This log was not found in the run."}
      </AlertDescription>
      <Button variant="outline" onClick={onBack}>
        Back to run
      </Button>
    </Alert>
  )
}
