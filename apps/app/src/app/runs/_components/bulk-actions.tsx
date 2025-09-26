"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RotateCcw, X, Trash2 } from "lucide-react";
import { useState } from "react";
import { bulkCancelJobsApiRoute } from "~/app/api/jobs/bulk-cancel/schemas";
import { bulkRetryJobsApiRoute } from "~/app/api/jobs/bulk-retry/schemas";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Badge } from "~/components/ui/badge";
import { apiFetch } from "~/lib/utils/client";

interface BulkActionsProps {
  selectedJobs: Array<{
    job_id: string;
    queue: string;
    status: string;
  }>;
  onClearSelection: () => void;
}

export function BulkActions({ selectedJobs, onClearSelection }: BulkActionsProps) {
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [retryDialogOpen, setRetryDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const bulkCancelMutation = useMutation({
    mutationFn: apiFetch({
      apiRoute: bulkCancelJobsApiRoute,
      body: {
        jobs: selectedJobs.map(job => ({
          jobId: job.job_id,
          queueName: job.queue,
        })),
      },
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["jobs/table"] });
      setCancelDialogOpen(false);
      onClearSelection();
    },
  });

  const bulkRetryMutation = useMutation({
    mutationFn: apiFetch({
      apiRoute: bulkRetryJobsApiRoute,
      body: {
        jobs: selectedJobs.map(job => ({
          jobId: job.job_id,
          queueName: job.queue,
        })),
      },
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["jobs/table"] });
      setRetryDialogOpen(false);
      onClearSelection();
    },
  });

  const handleBulkCancel = () => {
    bulkCancelMutation.mutate();
  };

  const handleBulkRetry = () => {
    bulkRetryMutation.mutate();
  };

  // Filter jobs that can be cancelled
  const cancellableJobs = selectedJobs.filter(job => 
    job.status === "active" || job.status === "waiting" || job.status === "delayed"
  );

  // Filter jobs that can be retried
  const retryableJobs = selectedJobs.filter(job => 
    job.status === "completed" || job.status === "failed"
  );

  if (selectedJobs.length === 0) {
    return null;
  }

  return (
    <>
      <div className="flex items-center gap-4 p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            {selectedJobs.length} job{selectedJobs.length === 1 ? '' : 's'} selected
          </Badge>
          {cancellableJobs.length > 0 && (
            <Badge variant="outline" className="text-red-600">
              {cancellableJobs.length} cancellable
            </Badge>
          )}
          {retryableJobs.length > 0 && (
            <Badge variant="outline" className="text-green-600">
              {retryableJobs.length} retryable
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {cancellableJobs.length > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setCancelDialogOpen(true)}
              className="flex items-center gap-2"
            >
              <X className="size-4" />
              Cancel ({cancellableJobs.length})
            </Button>
          )}
          
          {retryableJobs.length > 0 && (
            <Button
              variant="default"
              size="sm"
              onClick={() => setRetryDialogOpen(true)}
              className="flex items-center gap-2"
            >
              <RotateCcw className="size-4" />
              Retry ({retryableJobs.length})
            </Button>
          )}
          
          <Button
            variant="outline"
            size="sm"
            onClick={onClearSelection}
            className="flex items-center gap-2"
          >
            <Trash2 className="size-4" />
            Clear Selection
          </Button>
        </div>
      </div>

      {/* Cancel Confirmation Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600">Cancel Jobs</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel {cancellableJobs.length} job{cancellableJobs.length === 1 ? '' : 's'}? 
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-60 overflow-y-auto">
            <div className="space-y-2">
              {cancellableJobs.map((job) => (
                <div key={job.job_id} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded">
                  <Badge variant="outline">{job.queue}</Badge>
                  <span className="font-mono text-xs">{job.job_id.slice(0, 20)}...</span>
                  <Badge className="ml-auto">{job.status}</Badge>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleBulkCancel}
              disabled={bulkCancelMutation.isPending}
            >
              {bulkCancelMutation.isPending ? "Cancelling..." : "Cancel Jobs"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Retry Confirmation Dialog */}
      <Dialog open={retryDialogOpen} onOpenChange={setRetryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Retry Jobs</DialogTitle>
            <DialogDescription>
              Are you sure you want to retry {retryableJobs.length} job{retryableJobs.length === 1 ? '' : 's'}? 
              This will create new job instances with the same data and configuration.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-60 overflow-y-auto">
            <div className="space-y-2">
              {retryableJobs.map((job) => (
                <div key={job.job_id} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded">
                  <Badge variant="outline">{job.queue}</Badge>
                  <span className="font-mono text-xs">{job.job_id.slice(0, 20)}...</span>
                  <Badge className="ml-auto">{job.status}</Badge>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRetryDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleBulkRetry}
              disabled={bulkRetryMutation.isPending}
            >
              {bulkRetryMutation.isPending ? "Retrying..." : "Retry Jobs"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}