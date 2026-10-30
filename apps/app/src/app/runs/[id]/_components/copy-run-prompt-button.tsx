"use client"

import type { jobRunsTable } from "@better-bull-board/db"
import { Button } from "@better-bull-board/ui/components/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@better-bull-board/ui/components/tooltip"
import { BotMessageSquare, Check } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

type TRun = typeof jobRunsTable.$inferSelect

const COPIED_FEEDBACK_MS = 1500

const buildRunPrompt = (run: TRun, runUrl: string) => {
  const fields = [
    ["queue", run.queue],
    ["name", run.name],
    ["bullmq-job-id", run.jobId],
    ["status", run.status],
    ["attempt", run.maxAttempts ? `${run.attempt} / ${run.maxAttempts}` : null],
    ["created-at", run.createdAt.toISOString()],
    ["started-at", run.startedAt?.toISOString()],
    ["finished-at", run.finishedAt?.toISOString()],
    ["tags", run.tags?.length ? run.tags.join(", ") : null],
  ]
  // A stack usually starts with the message: don't send it twice
  const stackHasMessage = !!run.errorMessage && !!run.errorStack?.includes(run.errorMessage)
  const error = [stackHasMessage ? null : run.errorMessage, run.errorStack]
    .filter(Boolean)
    .join("\n\n")

  return [
    `Investigate Better Bull Board run ${run.id}:`,
    "",
    `Use the Better Bull Board MCP (bbb_* tools): bbb_get_job with id "${run.id}" returns the payload, result and error, and bbb_list_job_logs with the same id returns its logs (try level "error" first). Stay read-only: do not cancel, replay or pause anything unless I ask. Find the root cause in the code that processes the "${run.queue}" queue before proposing a fix.`,
    "",
    `<run id="${run.id}" url="${runUrl}">`,
    ...fields.filter(([, value]) => value).map(([tag, value]) => `<${tag}>${value}</${tag}>`),
    ...(error ? ["<error>", error, "</error>"] : []),
    "</run>",
  ].join("\n")
}

export function CopyRunPromptButton({ run }: { run: TRun }) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return undefined
    const timeout = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS)
    return () => clearTimeout(timeout)
  }, [copied])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(
        buildRunPrompt(run, `${window.location.origin}/runs/${run.id}`),
      )
      setCopied(true)
    } catch {
      toast.error("Could not copy the prompt")
    }
  }

  const label = copied ? "Prompt copied" : "Copy as prompt"

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={label}
            onClick={() => void handleCopy()}
          />
        }
      >
        {copied ? <Check className="text-success" /> : <BotMessageSquare />}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
