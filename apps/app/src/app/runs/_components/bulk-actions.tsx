"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RotateCcw, Trash2, X } from "lucide-react";
import { useState } from "react";
import { bulkCancelJobsApiRoute } from "~/app/api/jobs/bulk-cancel/schemas";
import { bulkReplayJobsApiRoute } from "~/app/api/jobs/bulk-replay/schemas";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { apiFetch } from "~/lib/utils/client";

interface BulkActionsProps {
  selectedJobs: Array<{
    jobId: string;
    queue: string;
    status: string;
  }>;
  onClearSelection: () => void;
}

export function BulkActions({ selectedJobs, onClearSelection }: BulkActionsProps) {
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [replayDialogOpen, setReplayDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const bulkCancelMutation = useMutation({
    mutationFn: apiFetch({
      apiRoute: bulkCancelJobsApiRoute,
      body: {
        jobs: selectedJobs.map((job) => ({
          jobId: job.jobId,
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

  const bulkReplayMutation = useMutation({
    mutationFn: apiFetch({
      apiRoute: bulkReplayJobsApiRoute,
      body: {
        jobs: selectedJobs.map((job) => ({
          jobId: job.jobId,
          queueName: job.queue,
        })),
      },
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["jobs/table"] });
      setReplayDialogOpen(false);
      onClearSelection();
    },
  });

  const handleBulkCancel = () => {
    bulkCancelMutation.mutate();
  };

  const handleBulkReplay = () => {
    bulkReplayMutation.mutate();
  };

  // Filter jobs that can be cancelled
  const cancellableJobs = selectedJobs.filter(
    (job) => job.status === "active" || job.status === "waiting" || job.status === "delayed",
  );

  // Filter jobs that can be retried
  const replayableJobs = selectedJobs.filter((job) => job.status === "completed" || job.status === "failed");

  if (selectedJobs.length === 0) {
    return null;
  }

  return (
    <>
      <div className="flex gap-2">
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

        {replayableJobs.length > 0 && (
          <Button
            variant="default"
            size="sm"
            onClick={() => setReplayDialogOpen(true)}
            className="flex items-center gap-2"
          >
            <RotateCcw className="size-4" />
            Replay ({replayableJobs.length})
          </Button>
        )}

        <Button variant="outline" size="sm" onClick={onClearSelection} className="flex items-center gap-2">
          <Trash2 className="size-4" />
          Clear Selection
        </Button>
      </div>

      {/* Cancel Confirmation Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600">Cancel Jobs</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel {cancellableJobs.length} job
              {cancellableJobs.length === 1 ? "" : "s"}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-60 overflow-y-auto">
            <div className="space-y-2">
              {cancellableJobs.map((job) => (
                <div key={job.jobId} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded">
                  <Badge variant="outline">{job.queue}</Badge>
                  <span className="font-mono text-xs">{job.jobId.slice(0, 20)}...</span>
                  <Badge className="ml-auto">{job.status}</Badge>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleBulkCancel} disabled={bulkCancelMutation.isPending}>
              {bulkCancelMutation.isPending ? "Cancelling..." : "Cancel Jobs"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Replay Confirmation Dialog */}
      <Dialog open={replayDialogOpen} onOpenChange={setReplayDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Replay Jobs</DialogTitle>
            <DialogDescription>
              Are you sure you want to replay {replayableJobs.length} job
              {replayableJobs.length === 1 ? "" : "s"}? This will create new job instances with the same data and
              configuration.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-60 overflow-y-auto">
            <div className="space-y-2">
              {replayableJobs.map((job) => (
                <div key={job.jobId} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded">
                  <Badge variant="outline">{job.queue}</Badge>
                  <span className="font-mono text-xs">{job.jobId.slice(0, 20)}...</span>
                  <Badge className="ml-auto">{job.status}</Badge>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReplayDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleBulkReplay} disabled={bulkReplayMutation.isPending}>
              {bulkReplayMutation.isPending ? "Replaying..." : "Replay Jobs"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
