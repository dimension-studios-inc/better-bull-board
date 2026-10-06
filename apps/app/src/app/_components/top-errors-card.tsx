"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@better-bull-board/ui/components/card"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@better-bull-board/ui/components/hover-card"
import { ScrollArea } from "@better-bull-board/ui/components/scroll-area"
import { Skeleton } from "@better-bull-board/ui/components/skeleton"
import { useQuery } from "@tanstack/react-query"
import { formatDistanceToNowStrict } from "date-fns"
import { CircleAlert } from "lucide-react"
import Link from "next/link"
import type { z } from "zod"
import { getDashboardTopErrorsApiRoute } from "~/app/api/dashboard/top-errors/schemas"
import { apiFetch } from "~/lib/utils/client"
import { formatUtcDateTime } from "~/lib/utils/date"
import { getRunsHref } from "~/lib/utils/runs-link"

type TopError = z.output<(typeof getDashboardTopErrorsApiRoute)["outputSchema"]>["errors"][number]

interface TopErrorsCardProps {
  minutes: number
  periodLabel: string
  /** False while the stored period is read */
  enabled: boolean
}

function SeenAt({ label, value }: { label: string; value: number }) {
  const date = new Date(value)

  return (
    <time dateTime={date.toISOString()} title={formatUtcDateTime(date)}>
      {label} {formatDistanceToNowStrict(date, { addSuffix: true })}
    </time>
  )
}

function TopErrorRow({ error, minutes }: { error: TopError; minutes: number }) {
  const message = error.normalizedMessage || "No error message"

  return (
    <li>
      <Link
        href={getRunsHref({ queue: error.queue, status: "failed", minutes, search: error.search })}
        className="flex items-center gap-3 rounded-md px-2 py-2.5 outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <HoverCard>
            <HoverCardTrigger
              delay={300}
              closeDelay={150}
              render={
                <span className="inline-flex max-w-full items-center gap-1.5 self-start text-xs text-destructive" />
              }
            >
              <CircleAlert className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate font-mono">{message}</span>
            </HoverCardTrigger>
            <HoverCardContent
              side="bottom"
              align="start"
              sideOffset={6}
              className="w-[min(36rem,calc(100vw-2rem))] gap-0 p-0"
              // Portaled out of the row link in the page, not in React: clicks in the card must not open the runs
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center gap-2 border-b px-3 py-2">
                <CircleAlert className="size-4 shrink-0 text-destructive" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{error.queue}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {error.count.toLocaleString()} failed {error.count === 1 ? "run" : "runs"}
                    {" · "}
                    <SeenAt label="first" value={error.firstSeenAt} />
                    {" · "}
                    <SeenAt label="last" value={error.lastSeenAt} />
                  </p>
                </div>
              </div>
              <ScrollArea className="[&>[data-slot=scroll-area-viewport]]:max-h-72">
                <pre className="whitespace-pre-wrap break-words bg-destructive/5 px-3 py-2.5 font-mono text-xs leading-relaxed text-destructive dark:bg-destructive/10">
                  {error.sampleMessage || "No error message"}
                </pre>
              </ScrollArea>
              {error.sampleMessage !== error.normalizedMessage && (
                <div className="border-t px-3 py-2">
                  <p className="text-xs text-muted-foreground">Grouped as</p>
                  <p className="line-clamp-3 break-words font-mono text-xs">{error.normalizedMessage}</p>
                </div>
              )}
            </HoverCardContent>
          </HoverCard>
          <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            <span className="truncate">{error.queue}</span>
            <span aria-hidden>·</span>
            <span className="shrink-0">
              <SeenAt label="last" value={error.lastSeenAt} />
            </span>
          </div>
        </div>
        <span className="shrink-0 font-mono text-sm font-medium">{error.count.toLocaleString()}</span>
      </Link>
    </li>
  )
}

export function TopErrorsCard({ minutes, periodLabel, enabled }: TopErrorsCardProps) {
  // Pending, not loading: the query waits for the stored period to be read
  const { data, isPending: isLoading } = useQuery({
    queryKey: ["dashboard/top-errors", minutes],
    queryFn: apiFetch({
      apiRoute: getDashboardTopErrorsApiRoute,
      body: { minutes },
    }),
    enabled,
    refetchInterval: minutes <= 60 ? 15 * 1000 : false,
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Errors</CardTitle>
        <CardDescription>
          {data?.isPartial
            ? `Latest ${data.scannedRuns.toLocaleString()} failed runs of the period, grouped by error`
            : `Failed runs grouped by error (${periodLabel.toLowerCase()})`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: skeleton
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : !data?.errors.length ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No failed runs in the selected period</p>
        ) : (
          <ScrollArea className="-mx-2 [&>[data-slot=scroll-area-viewport]]:max-h-96">
            <ul className="divide-y px-2">
              {data.errors.map((error) => (
                <TopErrorRow key={`${error.queue}:${error.normalizedMessage}`} error={error} minutes={minutes} />
              ))}
            </ul>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}
