"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import type React from "react";
import { useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { createJobApiRoute } from "~/app/api/jobs/create/schemas";
import { getLastRunDataApiRoute } from "~/app/api/jobs/last-run-data/schemas";
import { PageContainer } from "~/components/page-container";
import { PageTitle } from "~/components/page-title";
import { QueueSelector } from "~/components/queue-selector";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { apiFetch } from "~/lib/utils/client";

export default function CreateRunPage() {
  const router = useRouter();
  const [selectedQueue, setSelectedQueue] = useState<string>("");
  const [jobName, setJobName] = useState<string>("");
  const [jobData, setJobData] = useState<string>("{}");
  const [queueOpen, setQueueOpen] = useState(false);
  const [queueSearch, setQueueSearch] = useState("");

  // Fetch last run data when queue is selected
  const { data: lastRunData, isLoading: isLastRunLoading } = useQuery({
    queryKey: ["jobs/last-run-data", selectedQueue],
    queryFn: () =>
      apiFetch({
        apiRoute: getLastRunDataApiRoute,
        body: { queueName: selectedQueue },
      })(),
    enabled: !!selectedQueue && selectedQueue !== "all",
  });

  // Create job mutation
  const createJobMutation = useMutation({
    mutationFn: (data: {
      queueName: string;
      jobName: string;
      data: Record<string, unknown>;
    }) =>
      apiFetch({
        apiRoute: createJobApiRoute,
        body: data,
      })(),
    onSuccess: () => {
      toast.success("Job created successfully");
      router.push("/runs");
    },
  });

  const handleQueueChange = (value: string) => {
    setSelectedQueue(value);

    // Set default job name based on queue if not already set
    if (!jobName && value && value !== "all") {
      setJobName(`${value}-job`);
    }
  };

  // Update job data when last run data is loaded
  useEffect(() => {
    if (lastRunData?.data && selectedQueue) {
      setJobData(JSON.stringify(lastRunData.data, null, 2));

      // Update job name if we have a previous job name
      if (lastRunData.jobName && !jobName.endsWith("-job")) {
        setJobName(lastRunData.jobName);
      }
    }
  }, [lastRunData, selectedQueue, jobName]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedQueue || selectedQueue === "all") {
      toast.error("Please select a queue");
      return;
    }

    if (!jobName.trim()) {
      toast.error("Please enter a job name");
      return;
    }

    try {
      const parsedData = JSON.parse(jobData);
      createJobMutation.mutate({
        queueName: selectedQueue,
        jobName: jobName.trim(),
        data: parsedData,
      });
    } catch {
      toast.error("Invalid JSON data");
    }
  };

  const jobNameId = useId();
  const jobDataId = useId();

  return (
    <PageContainer>
      <div className="flex items-center justify-between">
        <PageTitle
          title="Create New Run"
          description="Create a new job run in a queue"
        />
        <Button variant="outline" onClick={() => router.push("/runs")}>
          Cancel
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 w-2xl">
        <div className="space-y-2">
          <label htmlFor="queue" className="text-sm font-medium mb-2 block">
            Queue *
          </label>
          <QueueSelector
            value={selectedQueue}
            onValueChange={handleQueueChange}
            search={queueSearch}
            setSearch={setQueueSearch}
            open={queueOpen}
            setOpen={setQueueOpen}
            placeholder="Select a queue..."
            className="w-full"
            popoverContentClassName="w-2xl"
          />
          {selectedQueue && selectedQueue !== "all" && isLastRunLoading && (
            <p className="text-sm text-muted-foreground">
              Loading last run data...
            </p>
          )}
          {selectedQueue && selectedQueue !== "all" && lastRunData && (
            <p className="text-sm text-muted-foreground">
              Data prefilled from last run in this queue
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor={jobNameId} className="text-sm font-medium mb-2 block">
            Job Name *
          </label>
          <Input
            id={jobNameId}
            value={jobName}
            onChange={(e) => setJobName(e.target.value)}
            placeholder="Enter job name..."
            required
          />
        </div>

        <div className="space-y-2">
          <label htmlFor={jobDataId} className="text-sm font-medium mb-2 block">
            Job Data (JSON)
          </label>
          <textarea
            id={jobDataId}
            value={jobData}
            onChange={(e) => setJobData(e.target.value)}
            placeholder="Enter job data as JSON..."
            className="flex min-h-[200px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono"
          />
          <p className="text-sm text-muted-foreground">
            Enter the job data as valid JSON. This data will be passed to the
            job when it runs.
          </p>
        </div>

        <div className="flex gap-3">
          <Button type="submit" disabled={createJobMutation.isPending}>
            {createJobMutation.isPending ? "Creating..." : "Create Run"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/runs")}
          >
            Cancel
          </Button>
        </div>
      </form>
    </PageContainer>
  );
}
