"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pause, Play, Trash2 } from "lucide-react";
import { useState } from "react";
import { deleteQueueApiRoute } from "~/app/api/queues/delete/schemas";
import { pauseQueueApiRoute } from "~/app/api/queues/pause/schemas";
import { resumeQueueApiRoute } from "~/app/api/queues/resume/schemas";
import { Button } from "~/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { apiFetch } from "~/lib/utils/client";

interface QueueActionsProps {
  queueName: string;
  isPaused: boolean;
}

export function QueueActions({ queueName, isPaused }: QueueActionsProps) {
  const [pausePopoverOpen, setPausePopoverOpen] = useState(false);
  const [deletePopoverOpen, setDeletePopoverOpen] = useState(false);
  const queryClient = useQueryClient();

  const pauseMutation = useMutation({
    mutationFn: apiFetch({
      apiRoute: pauseQueueApiRoute,
      body: { queueName },
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["queues/table"] });
      setPausePopoverOpen(false);
    },
  });

  const resumeMutation = useMutation({
    mutationFn: apiFetch({
      apiRoute: resumeQueueApiRoute,
      body: { queueName },
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["queues/table"] });
      setPausePopoverOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: apiFetch({
      apiRoute: deleteQueueApiRoute,
      body: { queueName },
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["queues/table"] });
      setDeletePopoverOpen(false);
    },
  });

  const handlePauseResume = () => {
    if (isPaused) {
      resumeMutation.mutate();
    } else {
      pauseMutation.mutate();
    }
  };

  const handleDelete = () => {
    deleteMutation.mutate();
  };

  return (
    <div className="flex gap-1">
      {/* Pause/Resume Button */}
      <Popover open={pausePopoverOpen} onOpenChange={setPausePopoverOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm">
            {isPaused ? <Play className="size-4" /> : <Pause className="size-4" />}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80">
          <div className="space-y-4">
            <div className="space-y-2">
              <h4 className="font-medium leading-none">{isPaused ? "Resume Queue" : "Pause Queue"}</h4>
              <p className="text-sm text-muted-foreground">
                {isPaused
                  ? `Are you sure you want to resume the queue "${queueName}"? This will allow jobs to be processed again.`
                  : `Are you sure you want to pause the queue "${queueName}"? This will stop processing new jobs.`}
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setPausePopoverOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handlePauseResume}
                disabled={pauseMutation.isPending || resumeMutation.isPending}
              >
                {isPaused ? "Resume" : "Pause"}
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Delete Button */}
      <Popover open={deletePopoverOpen} onOpenChange={setDeletePopoverOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700">
            <Trash2 className="size-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80">
          <div className="space-y-4">
            <div className="space-y-2">
              <h4 className="font-medium leading-none text-red-600">Delete Queue</h4>
              <p className="text-sm text-muted-foreground">
                Are you sure you want to delete the queue "{queueName}"? This action will permanently remove the queue
                and all its data. This action cannot be undone.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setDeletePopoverOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleteMutation.isPending}>
                Delete
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
