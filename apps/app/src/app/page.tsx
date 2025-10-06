"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";
import { EnhancedDashboard } from "~/app/_components/enhanced-dashboard";
import { PageContainer } from "~/components/page-container";
import { PageTitle } from "~/components/page-title";

export default function Home() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  useEffect(() => {
    if (error === "run-not-found") {
      toast.error("Run not found", {
        description: "The requested BigQuery run could not be found in the database.",
      });
    } else if (error === "server-error") {
      toast.error("Server error", {
        description: "An error occurred while trying to retrieve the run. Please try again.",
      });
    }
  }, [error]);

  return (
    <PageContainer>
      <PageTitle
        title="Dashboard"
        description="Monitor your BullMQ job statistics"
      />
      <EnhancedDashboard />
    </PageContainer>
  );
}
