import { PageContainer } from "~/components/page-container";
import { PageTitle } from "~/components/page-title";
import { RunsTable } from "./_components/runs-table";

export default function RunsPage() {
  return (
    <PageContainer>
      <PageTitle
        title="Job Runs"
        description="View and manage all job executions"
      />
      <RunsTable />
    </PageContainer>
  );
}
