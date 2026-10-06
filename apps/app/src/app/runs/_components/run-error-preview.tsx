"use client"

import { Button } from "@better-bull-board/ui/components/button"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@better-bull-board/ui/components/hover-card"
import { ScrollArea } from "@better-bull-board/ui/components/scroll-area"
import { formatDistanceToNowStrict } from "date-fns"
import { ArrowRight, Check, CircleAlert, Copy } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { formatUtcDateTime } from "~/lib/utils/date"

const COPIED_FEEDBACK_MS = 1500

type RunErrorPreviewProps = {
  errorMessage: string
  runPath: string
  attempt: number
  maxAttempts: number
  finishedAt: Date | null
}

function CopyErrorButton({ errorMessage }: { errorMessage: string }) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timeout = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS)
    return () => clearTimeout(timeout)
  }, [copied])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(errorMessage)
      setCopied(true)
    } catch {
      toast.error("Could not copy the error message")
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon-xs"
      aria-label={copied ? "Error message copied" : "Copy error message"}
      className="text-muted-foreground hover:text-foreground"
      onClick={handleCopy}
    >
      {copied ? <Check className="text-green-600 dark:text-green-400" /> : <Copy />}
    </Button>
  )
}

/**
 * Error cell of the runs table: the first line of the error, linking to the run, with the full message in a hover card.
 * A hover card (not a tooltip) so the message can be scrolled, selected and copied.
 */
export function RunErrorPreview({ errorMessage, runPath, attempt, maxAttempts, finishedAt }: RunErrorPreviewProps) {
  const firstLine = errorMessage.trim().split("\n")[0] || errorMessage

  return (
    <HoverCard>
      <HoverCardTrigger
        delay={300}
        closeDelay={150}
        render={
          <Link
            href={runPath}
            className="flex min-w-0 items-center gap-1.5 rounded-sm text-xs text-red-600 outline-none transition-colors hover:text-red-700 focus-visible:ring-2 focus-visible:ring-red-500/40 dark:text-red-400 dark:hover:text-red-300"
          />
        }
      >
        <CircleAlert className="size-3.5 shrink-0" aria-hidden />
        <span className="truncate font-mono">{firstLine}</span>
      </HoverCardTrigger>
      <HoverCardContent side="bottom" align="end" sideOffset={6} className="w-[min(36rem,calc(100vw-2rem))] gap-0 p-0">
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <CircleAlert className="size-4 shrink-0 text-red-600 dark:text-red-400" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Error</p>
            <p className="truncate text-xs text-muted-foreground">
              Attempt {attempt} / {maxAttempts}
              {finishedAt && (
                <>
                  {" · "}
                  <time dateTime={finishedAt.toISOString()} title={formatUtcDateTime(finishedAt)}>
                    failed {formatDistanceToNowStrict(finishedAt, { addSuffix: true })}
                  </time>
                </>
              )}
            </p>
          </div>
          <CopyErrorButton errorMessage={errorMessage} />
        </div>
        <ScrollArea className="[&>[data-slot=scroll-area-viewport]]:max-h-72">
          <pre className="whitespace-pre-wrap break-words bg-red-50/60 px-3 py-2.5 font-mono text-xs leading-relaxed text-red-700 dark:bg-red-950/20 dark:text-red-300">
            {errorMessage}
          </pre>
        </ScrollArea>
        <div className="flex justify-end border-t px-2 py-1.5">
          <Button variant="ghost" size="xs" nativeButton={false} render={<Link href={runPath} />}>
            View run
            <ArrowRight data-icon="inline-end" />
          </Button>
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}
