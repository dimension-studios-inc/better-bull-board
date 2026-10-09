"use client"

import { Alert, AlertDescription } from "@better-bull-board/ui/components/alert"
import { Button } from "@better-bull-board/ui/components/button"
import { useQuery } from "@tanstack/react-query"
import { AlertCircle, List } from "lucide-react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"

import { getQueueDetailsApiRoute } from "~/app/api/queues/details/schemas"
import { getQueueSummaryApiRoute } from "~/app/api/queues/summary/schemas"
import { QueueActions } from "~/app/queues/_components/queue-actions"
import { ChartCardSkeleton } from "~/components/chart-card-skeleton"
import { PageContainer } from "~/components/page-container"
import { TimePeriodSelector } from "~/components/time-period-selector"
import { DEFAULT_TIME_PERIOD, getTimePeriodLabel, useStoredTimePeriod } from "~/lib/time-period"
import { apiFetch } from "~/lib/utils/client"
import { decodePathSegment } from "~/lib/utils/path"
import { getRunsHref } from "~/lib/utils/runs-link"

import { QueueHeader } from "./_components/queue-header"
import { QueueSummaryCards } from "./_components/queue-summary-cards"

// recharts only renders in the browser: load the charts on demand instead of in the page bundle
const QueueRunsChart = dynamic(
  () => import("./_components/queue-charts").then((charts) => charts.QueueRunsChart),
  { ssr: false, loading: ChartCardSkeleton },
)
const QueueErrorRateChart = dynamic(
  () => import("./_components/queue-charts").then((charts) => charts.QueueErrorRateChart),
  { ssr: false, loading: ChartCardSkeleton },
)
const QueueDurationChart = dynamic(
  () => import("./_components/queue-charts").then((charts) => charts.QueueDurationChart),
  { ssr: false, loading: ChartCardSkeleton },
)

export default function QueuePage() {
  const params = useParams<{ name: string }>()
  const router = useRouter()
  // Next.js hands dynamic segments over URL encoded
  const queueName = decodePathSegment(params.name)

  const [storedMinutes, setMinutes] = useStoredTimePeriod()
  const minutes = storedMinutes ?? DEFAULT_TIME_PERIOD
  const periodLabel = getTimePeriodLabel(minutes)

  const {
    data: details,
    isPending: isLoadingDetails,
    error: detailsError,
  } = useQuery({
    queryKey: ["queues/details", queueName],
    queryFn: apiFetch({ apiRoute: getQueueDetailsApiRoute, body: { queueName } }),
    refetchInterval: 15 * 1000,
  })

  // Pending, not loading: the query waits for the stored period to be read
  const { data: summary, isPending: isLoadingSummary } = useQuery({
    queryKey: ["queues/summary", queueName, minutes],
    queryFn: apiFetch({ apiRoute: getQueueSummaryApiRoute, body: { queueName, minutes } }),
    enabled: storedMinutes !== null,
    // Short periods move fast: keep them live
    refetchInterval: minutes <= 60 ? 15 * 1000 : false,
  })

  if (detailsError) {
    return (
      <PageContainer>
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>
            Failed to load the queue {queueName}. The queue might not exist or there was an error
            loading it.
          </AlertDescription>
        </Alert>
      </PageContainer>
    )
  }

  const chartProps = { minutes, periodLabel, graph: summary?.graph, isLoading: isLoadingSummary }

  return (
    <PageContainer>
      <QueueHeader queueName={queueName} details={details} isLoading={isLoadingDetails} />

      <div className="flex items-center gap-2">
        <TimePeriodSelector value={minutes} onChange={setMinutes} />
        <Button
          variant="outline"
          nativeButton={false}
          // The link holds the time it is rendered at: none while hydrating, or it would not match the server
          render={<Link href={getRunsHref({ queue: queueName, minutes: storedMinutes })} />}
        >
          <List className="size-4" />
          View runs
        </Button>
        {details && (
          <div className="ml-auto">
            <QueueActions
              queueName={details.name}
              isPaused={details.isPaused}
              onDeleted={() => router.push("/queues")}
            />
          </div>
        )}
      </div>

      <QueueSummaryCards
        queueName={queueName}
        minutes={storedMinutes}
        periodLabel={periodLabel}
        stats={summary?.stats}
        isLoading={isLoadingSummary}
      />

      <QueueRunsChart {...chartProps} />

      <div className="grid grid-cols-1 gap-4 md:gap-6 @4xl/main:grid-cols-2">
        <QueueErrorRateChart {...chartProps} />
        <QueueDurationChart {...chartProps} />
      </div>
    </PageContainer>
  )
}
