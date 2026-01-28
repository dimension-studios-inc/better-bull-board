"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RotateCcw, X } from "lucide-react";
import { useState } from "react";
import { cancelJobApiRoute } from "~/app/api/jobs/cancel/schemas";
import { replayJobApiRoute } from "~/app/api/jobs/replay/schemas";
import { Button } from "~/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { apiFetch } from "~/lib/utils/client";

interface RunActionsProps {
  jobId: string;
  queueName: string;
  status: string;
}

export function RunActions({ jobId, queueName, status }: RunActionsProps) {
  const [cancelPopoverOpen, setCancelPopoverOpen] = useState(false);
  const [replayPopoverOpen, setReplayPopoverOpen] = useState(false);
  const queryClient = useQueryClient();

  const cancelMutation = useMutation({
    mutationFn: apiFetch({
      apiRoute: cancelJobApiRoute,
      body: { jobId, queueName },
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["jobs/table"] });
      setCancelPopoverOpen(false);
    },
  });

  const replayMutation = useMutation({
    mutationFn: apiFetch({
      apiRoute: replayJobApiRoute,
      body: { jobId, queueName },
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["jobs/table"] });
      setReplayPopoverOpen(false);
    },
  });

  const handleCancel = () => {
    cancelMutation.mutate();
  };

  const handleReplay = () => {
    replayMutation.mutate();
  };

  const canCancel = status === "active" || status === "waiting" || status === "delayed";
  const canReplay = status === "completed" || status === "failed";

  if (!canCancel && !canReplay) {
    return null;
  }

  return (
    <div className="flex gap-1">
      {/* Cancel Button - only show for active, waiting, or delayed jobs */}
      {canCancel && (
        <Popover open={cancelPopoverOpen} onOpenChange={setCancelPopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700">
              <X className="size-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <div className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-medium leading-none text-red-600">Cancel Job</h4>
                <p className="text-sm text-muted-foreground">
                  Are you sure you want to cancel this job? This action cannot be undone.
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setCancelPopoverOpen(false)}>
                  Cancel
                </Button>
                <Button variant="destructive" size="sm" onClick={handleCancel} disabled={cancelMutation.isPending}>
                  Cancel Job
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      )}

      {/* Replay Button - only show for completed or failed jobs */}
      {canReplay && (
        <Popover open={replayPopoverOpen} onOpenChange={setReplayPopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm">
              <RotateCcw className="size-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <div className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-medium leading-none">Replay Job</h4>
                <p className="text-sm text-muted-foreground">
                  Are you sure you want to replay this job? This will create a new job with the same data and
                  configuration.
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setReplayPopoverOpen(false)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleReplay} disabled={replayMutation.isPending}>
                  Replay Job
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
