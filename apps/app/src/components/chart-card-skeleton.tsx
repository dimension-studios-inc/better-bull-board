import { Skeleton } from "@better-bull-board/ui/components/skeleton"

/** Holds the place of a chart card while its lazily loaded chart code downloads */
export function ChartCardSkeleton() {
  return <Skeleton className="h-104 w-full" />
}
