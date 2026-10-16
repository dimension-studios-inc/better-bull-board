"use client"

import { Button } from "@better-bull-board/ui/components/button"
import { Popover, PopoverContent, PopoverTrigger } from "@better-bull-board/ui/components/popover"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { revokeApiKeyApiRoute } from "~/app/api/api-keys/[id]/revoke/schemas"
import { apiFetch } from "~/lib/utils/client"

export function RevokeApiKeyButton({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()

  const revokeMutation = useMutation({
    mutationFn: apiFetch({ apiRoute: revokeApiKeyApiRoute, body: undefined, urlParams: { id } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["api-keys"] })
      setOpen(false)
      toast.success(`Revoked "${name}"`)
    },
  })

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={<Button variant="destructive" size="icon-sm" aria-label={`Revoke ${name}`} />}
      >
        <Trash2 className="size-4" />
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div className="space-y-2">
            <h4 className="leading-none font-medium text-destructive">Revoke API key</h4>
            <p className="text-sm text-muted-foreground">
              Revoke "{name}"? Any agent using it loses access to the MCP endpoint immediately. This
              cannot be undone.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => revokeMutation.mutate()}
              disabled={revokeMutation.isPending}
            >
              Revoke
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
