import { formatDistanceToNow } from "date-fns";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { searchJobRuns } from "~/lib/job-run-data-schema";

export async function RunsTable() {
  const runs = await searchJobRuns({ limit: 100 });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "failed":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
      case "active":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      case "waiting":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
      case "delayed":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
    }
  };

  const formatDuration = (startedAt: Date | null, finishedAt: Date | null) => {
    if (!startedAt || !finishedAt) return "-";
    const duration =
      new Date(finishedAt).getTime() - new Date(startedAt).getTime();
    return `${Math.round(duration / 1000)}s`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Latest Runs (100)</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Job ID</TableHead>
              <TableHead>Queue</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Attempt</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Worker</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Error</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.map((run) => (
              <TableRow key={run.id}>
                <TableCell className="font-mono text-xs">
                  {run.job_id.slice(0, 8)}...
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{run.queue}</Badge>
                </TableCell>
                <TableCell className="max-w-32 truncate">
                  {run.name || "-"}
                </TableCell>
                <TableCell>
                  <Badge className={getStatusColor(run.status)}>
                    {run.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {run.attempt}/{run.max_attempts}
                </TableCell>
                <TableCell>{run.priority || "-"}</TableCell>
                <TableCell>
                  {formatDuration(run.started_at, run.finished_at)}
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {run.worker_id ? run.worker_id.slice(0, 8) + "..." : "-"}
                </TableCell>
                <TableCell className="text-xs">
                  {formatDistanceToNow(new Date(run.created_at), {
                    addSuffix: true,
                  })}
                </TableCell>
                <TableCell className="max-w-48 truncate text-xs text-red-600">
                  {run.error_message || "-"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
