"use client"

import { Button } from "@better-bull-board/ui/components/button"
import { Popover, PopoverContent, PopoverTrigger } from "@better-bull-board/ui/components/popover"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Pause, Play, Trash2 } from "lucide-react"
import { useState } from "react"

import { deleteQueueApiRoute } from "~/app/api/queues/delete/schemas"
import { pauseQueueApiRoute } from "~/app/api/queues/pause/schemas"
import { resumeQueueApiRoute } from "~/app/api/queues/resume/schemas"
import { apiFetch } from "~/lib/utils/client"

interface QueueActionsProps {
  queueName: string
  isPaused: boolean
  /** Called once the queue is deleted, e.g. to leave its page */
  onDeleted?: () => void
}

export function QueueActions({ queueName, isPaused, onDeleted }: QueueActionsProps) {
  const [pausePopoverOpen, setPausePopoverOpen] = useState(false)
  const [deletePopoverOpen, setDeletePopoverOpen] = useState(false)
  const queryClient = useQueryClient()

  const pauseMutation = useMutation({
    mutationFn: apiFetch({
      apiRoute: pauseQueueApiRoute,
      body: { queueName },
    }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["queues/table"] }),
        queryClient.invalidateQueries({ queryKey: ["queues/details", queueName] }),
      ])
      setPausePopoverOpen(false)
    },
  })

  const resumeMutation = useMutation({
    mutationFn: apiFetch({
      apiRoute: resumeQueueApiRoute,
      body: { queueName },
    }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["queues/table"] }),
        queryClient.invalidateQueries({ queryKey: ["queues/details", queueName] }),
      ])
      setPausePopoverOpen(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: apiFetch({
      apiRoute: deleteQueueApiRoute,
      body: { queueName },
    }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["queues/table"] })
      setDeletePopoverOpen(false)
      // The route reports a failed delete in its result rather than as an error
      if (deleteQueueApiRoute.outputSchema.parse(result).success) onDeleted?.()
    },
  })

  const handlePauseResume = () => {
    if (isPaused) {
      resumeMutation.mutate()
    } else {
      pauseMutation.mutate()
    }
  }

  const handleDelete = () => {
    deleteMutation.mutate()
  }

  return (
    <div className="flex gap-1">
      {/* Pause/Resume Button */}
      <Popover open={pausePopoverOpen} onOpenChange={setPausePopoverOpen}>
        <PopoverTrigger render={<Button variant="ghost" size="icon-sm" />}>
          {isPaused ? <Play className="size-4" /> : <Pause className="size-4" />}
        </PopoverTrigger>
        <PopoverContent className="w-80">
          <div className="space-y-4">
            <div className="space-y-2">
              <h4 className="leading-none font-medium">
                {isPaused ? "Resume Queue" : "Pause Queue"}
              </h4>
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
        <PopoverTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            />
          }
        >
          <Trash2 className="size-4" />
        </PopoverTrigger>
        <PopoverContent className="w-80">
          <div className="space-y-4">
            <div className="space-y-2">
              <h4 className="leading-none font-medium text-destructive">Delete Queue</h4>
              <p className="text-sm text-muted-foreground">
                Are you sure you want to delete the queue "{queueName}"? This action will
                permanently remove the queue and all its data. This action cannot be undone.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setDeletePopoverOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
              >
                Delete
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
