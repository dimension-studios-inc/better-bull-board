import { jobRunsTable } from "@better-bull-board/db";
import { db } from "@better-bull-board/db/server";
import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

interface BqRunPageProps {
  params: Promise<{
    queueName: string;
    runId: string;
  }>;
}

export default async function BqRunPage({ params }: BqRunPageProps) {
  const { queueName, runId } = await params;

  try {
    // Decode URL parameters in case they contain special characters
    const decodedQueueName = decodeURIComponent(queueName);
    const decodedRunId = decodeURIComponent(runId);

    // Query the database to find the job run by queue name and job ID
    const [jobRun] = await db
      .select({ id: jobRunsTable.id })
      .from(jobRunsTable)
      .where(
        and(
          eq(jobRunsTable.queue, decodedQueueName),
          eq(jobRunsTable.jobId, decodedRunId)
        )
      )
      .limit(1);

    if (jobRun) {
      // Redirect to the runs page with the database ID
      redirect(`/runs/${jobRun.id}`);
    } else {
      // Job not found, redirect to home with error toast
      redirect("/?error=run-not-found");
    }
  } catch (error) {
    console.error("Error retrieving job run:", error);
    // On error, redirect to home with error toast
    redirect("/?error=server-error");
  }
}