import { PageContainer } from "~/components/page-container";
import { PageTitle } from "~/components/page-title";
import { RunsTable } from "./_components/runs-table";

type RunsPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function RunsPage({ searchParams }: RunsPageProps) {
  const resolvedSearchParams = await searchParams;

  return (
    <PageContainer>
      <PageTitle
        title="Job Runs"
        description="View and manage all job executions"
      />
      <RunsTable searchParams={resolvedSearchParams} />
    </PageContainer>
  );
}
