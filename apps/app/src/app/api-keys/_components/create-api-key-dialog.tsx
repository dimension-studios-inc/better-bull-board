"use client"

import { Alert, AlertDescription, AlertTitle } from "@better-bull-board/ui/components/alert"
import { Button } from "@better-bull-board/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@better-bull-board/ui/components/dialog"
import { Input } from "@better-bull-board/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@better-bull-board/ui/components/select"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Check, Copy, Plus, TriangleAlert } from "lucide-react"
import type React from "react"
import { useId, useState } from "react"
import { toast } from "sonner"

import { type ApiKeyScope, createApiKeyApiRoute } from "~/app/api/api-keys/schemas"
import { apiFetch } from "~/lib/utils/client"

const scopeOptions: { value: ApiKeyScope; label: string }[] = [
  { value: "bbb:read", label: "Read only" },
  { value: "bbb:read bbb:write", label: "Read + write" },
]

export function CreateApiKeyDialog() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [scope, setScope] = useState<ApiKeyScope>("bbb:read")
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const nameId = useId()
  const scopeId = useId()
  const queryClient = useQueryClient()

  const createMutation = useMutation({
    mutationFn: (input: { name: string; scope: ApiKeyScope }) =>
      apiFetch({ apiRoute: createApiKeyApiRoute, body: input })(),
    onSuccess: async (data) => {
      setCreatedKey(data.key)
      await queryClient.invalidateQueries({ queryKey: ["api-keys"] })
    },
  })

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) {
      // Drop the plaintext key once the dialog closes
      setName("")
      setScope("bbb:read")
      setCreatedKey(null)
      setCopied(false)
    }
  }

  const handleSubmit = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error("Please enter a name")
      return
    }
    createMutation.mutate({ name: name.trim(), scope })
  }

  const handleCopy = async () => {
    if (!createdKey) return
    try {
      await navigator.clipboard.writeText(createdKey)
      setCopied(true)
    } catch {
      toast.error("Could not copy the API key")
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button />}>
        <Plus data-icon="inline-start" />
        Create key
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        {createdKey ? (
          <>
            <DialogHeader>
              <DialogTitle>API key created</DialogTitle>
              <DialogDescription>
                Send it as <span className="font-mono">Authorization: Bearer &lt;key&gt;</span> to
                the MCP endpoint.
              </DialogDescription>
            </DialogHeader>
            <Alert>
              <TriangleAlert />
              <AlertTitle>Copy this key now</AlertTitle>
              <AlertDescription>
                It won't be shown again. If you lose it, revoke it and create a new one.
              </AlertDescription>
            </Alert>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 rounded-lg border bg-muted/50 px-2.5 py-1.5 font-mono text-xs break-all select-all">
                {createdKey}
              </code>
              <Button
                variant="outline"
                size="icon"
                onClick={() => void handleCopy()}
                aria-label={copied ? "API key copied" : "Copy API key"}
              >
                {copied ? <Check /> : <Copy />}
              </Button>
            </div>
            <DialogFooter>
              <Button onClick={() => handleOpenChange(false)}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>Create API key</DialogTitle>
              <DialogDescription>
                Name it after the agent that uses it, so you know what to revoke later.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <label htmlFor={nameId} className="block text-sm font-medium">
                Name
              </label>
              <Input
                id={nameId}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Discord bot"
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor={scopeId} className="block text-sm font-medium">
                Scope
              </label>
              <Select
                items={scopeOptions}
                value={scope}
                onValueChange={(value) => {
                  if (value) setScope(value)
                }}
              >
                <SelectTrigger id={scopeId} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {scopeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                Create key
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
