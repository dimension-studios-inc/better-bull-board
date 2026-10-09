"use client"

import { useSearchParams } from "next/navigation"
import { Suspense, useEffect } from "react"
import { toast } from "sonner"

import { EnhancedDashboard } from "~/app/_components/enhanced-dashboard"
import { PageContainer } from "~/components/page-container"

// The bq-runs redirect lands here with `?error=`
function RedirectErrorToast() {
  const searchParams = useSearchParams()
  const error = searchParams.get("error")

  useEffect(() => {
    if (error === "run-not-found") {
      toast.error("Run not found", {
        description: "The requested BigQuery run could not be found in the database.",
      })
    } else if (error === "server-error") {
      toast.error("Server error", {
        description: "An error occurred while trying to retrieve the run. Please try again.",
      })
    }
  }, [error])

  return null
}

export default function Home() {
  return (
    <PageContainer>
      <Suspense fallback={null}>
        <RedirectErrorToast />
      </Suspense>
      <EnhancedDashboard />
    </PageContainer>
  )
}
