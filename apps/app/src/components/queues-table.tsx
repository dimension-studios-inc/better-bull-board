import { Pause, Play, RotateCcw, Trash2 } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { getQueueInfo } from "~/lib/queue-info";

export async function QueuesTable() {
  const queues = await getQueueInfo();

  const getHealthColor = (health: string) => {
    switch (health) {
      case "healthy":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "warning":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
      case "error":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Queue Overview</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Queue Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Health</TableHead>
              <TableHead>Scheduler</TableHead>
              <TableHead>Active Jobs</TableHead>
              <TableHead>Waiting Jobs</TableHead>
              <TableHead>Failed Jobs</TableHead>
              <TableHead>Completed Jobs</TableHead>
              <TableHead>Workers</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {queues.map((queue) => (
              <TableRow key={queue.name}>
                <TableCell className="font-medium">{queue.name}</TableCell>
                <TableCell>
                  <Badge variant={queue.isPaused ? "secondary" : "default"}>
                    {queue.isPaused ? "Paused" : "Running"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge className={getHealthColor(queue.health)}>
                    {queue.health}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={queue.hasScheduler ? "default" : "outline"}>
                    {queue.hasScheduler ? "Yes" : "No"}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  <span className="font-mono">{queue.activeJobs}</span>
                </TableCell>
                <TableCell className="text-center">
                  <span className="font-mono">{queue.waitingJobs}</span>
                </TableCell>
                <TableCell className="text-center">
                  <span className="font-mono text-red-600">
                    {queue.failedJobs}
                  </span>
                </TableCell>
                <TableCell className="text-center">
                  <span className="font-mono text-green-600">
                    {queue.completedJobs}
                  </span>
                </TableCell>
                <TableCell className="text-center">
                  <span className="font-mono">{queue.workers}</span>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm">
                      {queue.isPaused ? (
                        <Play className="h-4 w-4" />
                      ) : (
                        <Pause className="h-4 w-4" />
                      )}
                    </Button>
                    <Button variant="ghost" size="sm">
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
