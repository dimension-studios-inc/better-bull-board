import { PageContainer } from "~/components/page-container";
import { PageTitle } from "~/components/page-title";
import { RunsTable } from "./_components/runs-table";

type RunsPageProps = {
  searchParams: { [key: string]: string | string[] | undefined };
};

export default function RunsPage({ searchParams }: RunsPageProps) {
  return (
    <PageContainer>
      <PageTitle
        title="Job Runs"
        description="View and manage all job executions"
      />
      <RunsTable searchParams={searchParams} />
    </PageContainer>
  );
}
