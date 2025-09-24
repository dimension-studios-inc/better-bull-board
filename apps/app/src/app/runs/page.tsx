import { RunsFilters } from "~/components/runs-filters";
import { RunsTable } from "~/components/runs-table";

export default function RunsPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Job Runs</h1>
        <p className="text-muted-foreground">
          View and manage all job executions
        </p>
      </div>

      <RunsFilters />
      <RunsTable />
    </div>
  );
}
