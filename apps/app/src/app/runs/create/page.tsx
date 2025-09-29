"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import { createJobApiRoute } from "~/app/api/jobs/create/schemas";
import { getLastRunDataApiRoute } from "~/app/api/jobs/last-run-data/schemas";
import { getQueuesTableApiRoute } from "~/app/api/queues/table/schemas";
import { PageContainer } from "~/components/page-container";
import { PageTitle } from "~/components/page-title";
import { Button } from "~/components/ui/button";
import { Combobox, type ComboboxOption } from "~/components/ui/combobox";
import { Input } from "~/components/ui/input";
import { apiFetch } from "~/lib/utils/client";
import { toast } from "sonner";

export default function CreateRunPage() {
  const router = useRouter();
  const [selectedQueue, setSelectedQueue] = useState<string>("");
  const [jobName, setJobName] = useState<string>("");
  const [jobData, setJobData] = useState<string>("{}");
  const [queueOpen, setQueueOpen] = useState(false);
  const [queueSearch, setQueueSearch] = useState("");

  // Fetch queues
  const { data: queuesData, isLoading: isQueuesLoading } = useQuery({
    queryKey: ["queues/table", queueSearch],
    queryFn: () =>
      apiFetch({
        apiRoute: getQueuesTableApiRoute,
        body: {
          search: queueSearch,
          cursor: null,
          timePeriod: "1",
        },
      })(),
  });

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
    mutationFn: (data: { queueName: string; jobName: string; data: Record<string, unknown> }) =>
      apiFetch({
        apiRoute: createJobApiRoute,
        body: data,
      })(),
    onSuccess: (result) => {
      toast.success(result.message);
      router.push("/runs");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to create job");
    },
  });

  const queueOptions: ComboboxOption[] = [
    ...(queuesData?.queues?.map((queue) => ({
      value: queue.name,
      label: queue.name,
    })) || []),
  ];

  const handleQueueChange = (value: string) => {
    setSelectedQueue(value);
    
    // Set default job name based on queue if not already set
    if (!jobName && value && value !== "all") {
      setJobName(`${value}-job`);
    }
  };

  // Update job data when last run data is loaded
  React.useEffect(() => {
    if (lastRunData?.data && selectedQueue) {
      setJobData(JSON.stringify(lastRunData.data, null, 2));
      
      // Update job name if we have a previous job name
      if (lastRunData.jobName && !jobName.endsWith("-job")) {
        setJobName(lastRunData.jobName);
      }
    }
  }, [lastRunData, selectedQueue]);

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
    } catch (error) {
      toast.error("Invalid JSON data");
    }
  };

  return (
    <PageContainer>
      <>
        <div className="flex items-center justify-between">
          <PageTitle
            title="Create New Run"
            description="Create a new job run in a queue"
          />
          <Button
            variant="outline"
            onClick={() => router.push("/runs")}
          >
            Cancel
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
        <div className="space-y-2">
          <label htmlFor="queue" className="text-sm font-medium mb-2 block">
            Queue *
          </label>
          <Combobox
            value={selectedQueue}
            onValueChange={handleQueueChange}
            options={queueOptions}
            placeholder="Select a queue..."
            noOptionsMessage="No queues found"
            searchPlaceholder="Search queues..."
            search={queueSearch}
            setSearch={setQueueSearch}
            open={queueOpen}
            setOpen={setQueueOpen}
            renderValue={(value) => {
              const option = queueOptions?.find((opt) => opt.value === value);
              return option ? option.label : isQueuesLoading ? "Loading..." : "";
            }}
            className="w-full"
            isFetching={isQueuesLoading}
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
          <label htmlFor="jobName" className="text-sm font-medium mb-2 block">
            Job Name *
          </label>
          <Input
            id="jobName"
            value={jobName}
            onChange={(e) => setJobName(e.target.value)}
            placeholder="Enter job name..."
            required
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="jobData" className="text-sm font-medium mb-2 block">
            Job Data (JSON)
          </label>
          <textarea
            id="jobData"
            value={jobData}
            onChange={(e) => setJobData(e.target.value)}
            placeholder="Enter job data as JSON..."
            className="flex min-h-[200px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono"
          />
          <p className="text-sm text-muted-foreground">
            Enter the job data as valid JSON. This data will be passed to the job when it runs.
          </p>
        </div>

        <div className="flex gap-3">
          <Button
            type="submit"
            disabled={createJobMutation.isPending}
          >
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
      </>
    </PageContainer>
  );
}