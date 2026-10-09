"use client"

import { Button } from "@better-bull-board/ui/components/button"
import { Input } from "@better-bull-board/ui/components/input"
import { useMutation, useQuery } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import type React from "react"
import { useId, useState } from "react"
import { toast } from "sonner"

import { createJobApiRoute } from "~/app/api/jobs/create/schemas"
import { getLastRunDataApiRoute } from "~/app/api/jobs/last-run-data/schemas"
import { PageContainer } from "~/components/page-container"
import { QueueSelector } from "~/components/queue-selector"
import { apiFetch } from "~/lib/utils/client"

export default function CreateRunPage() {
  const router = useRouter()
  const [selectedQueue, setSelectedQueue] = useState<string>("")
  const [jobName, setJobName] = useState<string>("")
  // Until the user types a job name, it follows the selected queue and its last run
  const [isJobNameEdited, setIsJobNameEdited] = useState(false)
  const [jobData, setJobData] = useState<string>("{}")
  const [queueOpen, setQueueOpen] = useState(false)
  const [queueSearch, setQueueSearch] = useState("")

  // Fetch last run data when queue is selected
  const { data: lastRunData, isLoading: isLastRunLoading } = useQuery({
    queryKey: ["jobs/last-run-data", selectedQueue],
    queryFn: () =>
      apiFetch({
        apiRoute: getLastRunDataApiRoute,
        body: { queueName: selectedQueue },
      })(),
    enabled: !!selectedQueue && selectedQueue !== "all",
  })

  // Create job mutation
  const createJobMutation = useMutation({
    mutationFn: (data: { queueName: string; jobName: string; data: Record<string, unknown> }) =>
      apiFetch({
        apiRoute: createJobApiRoute,
        body: data,
      })(),
    onSuccess: () => {
      toast.success("Job created successfully")
      router.push("/runs")
    },
  })

  const handleQueueChange = (value: string) => {
    setSelectedQueue(value)

    // Default the job name to the queue, unless the user typed one
    if (!isJobNameEdited && value && value !== "all") {
      setJobName(`${value}-job`)
    }
  }

  // Prefill the job data once each time last run data is loaded, so later edits are kept
  const [prefilledFrom, setPrefilledFrom] = useState<typeof lastRunData>(undefined)
  if (lastRunData !== prefilledFrom) {
    setPrefilledFrom(lastRunData)

    if (lastRunData?.data && selectedQueue) {
      setJobData(JSON.stringify(lastRunData.data, null, 2))

      // Prefer the last run's job name over the queue default, but never overwrite a typed name
      if (lastRunData.jobName && !isJobNameEdited) {
        setJobName(lastRunData.jobName)
      }
    }
  }

  const handleSubmit = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (!selectedQueue || selectedQueue === "all") {
      toast.error("Please select a queue")
      return
    }

    if (!jobName.trim()) {
      toast.error("Please enter a job name")
      return
    }

    try {
      const parsedData = JSON.parse(jobData) as Record<string, unknown>
      createJobMutation.mutate({
        queueName: selectedQueue,
        jobName: jobName.trim(),
        data: parsedData,
      })
    } catch {
      toast.error("Invalid JSON data")
    }
  }

  const queueId = useId()
  const jobNameId = useId()
  const jobDataId = useId()

  return (
    <PageContainer>
      <form onSubmit={handleSubmit} className="w-full max-w-2xl space-y-6">
        <div className="space-y-2">
          <label htmlFor={queueId} className="mb-2 block text-sm font-medium">
            Queue *
          </label>
          <QueueSelector
            id={queueId}
            value={selectedQueue}
            onValueChange={handleQueueChange}
            search={queueSearch}
            setSearch={setQueueSearch}
            open={queueOpen}
            setOpen={setQueueOpen}
            placeholder="Select a queue..."
            className="w-full"
            allowCustomValue
          />
          {selectedQueue && selectedQueue !== "all" && isLastRunLoading && (
            <p className="text-sm text-muted-foreground">Loading last run data...</p>
          )}
          {selectedQueue && selectedQueue !== "all" && lastRunData && (
            <p className="text-sm text-muted-foreground">
              Data prefilled from last run in this queue
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor={jobNameId} className="mb-2 block text-sm font-medium">
            Job Name *
          </label>
          <Input
            id={jobNameId}
            value={jobName}
            onChange={(e) => {
              setJobName(e.target.value)
              // Clearing the field hands the name back to the queue and last run defaults
              setIsJobNameEdited(e.target.value !== "")
            }}
            placeholder="Enter job name..."
            required
          />
        </div>

        <div className="space-y-2">
          <label htmlFor={jobDataId} className="mb-2 block text-sm font-medium">
            Job Data (JSON)
          </label>
          <textarea
            id={jobDataId}
            value={jobData}
            onChange={(e) => setJobData(e.target.value)}
            placeholder="Enter job data as JSON..."
            className="flex min-h-[200px] w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          />
          <p className="text-sm text-muted-foreground">
            Enter the job data as valid JSON. This data will be passed to the job when it runs.
          </p>
        </div>

        <div className="flex gap-3">
          <Button type="submit" disabled={createJobMutation.isPending}>
            {createJobMutation.isPending ? "Creating..." : "Create Run"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.push("/runs")}>
            Cancel
          </Button>
        </div>
      </form>
    </PageContainer>
  )
}
