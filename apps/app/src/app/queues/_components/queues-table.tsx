"use client";

import { useQuery } from "@tanstack/react-query";
import { formatDuration } from "date-fns";
import { Pause, Play, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { getQueuesTableApiRoute } from "~/app/api/queues/table/schemas";
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
import { apiFetch } from "~/lib/utils";

export function QueuesTable() {
  const [options, setOptions] = useState<{
    cursor: string | null;
    search: string;
  }>({
    cursor: null,
    search: "",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["queues/table", options],
    queryFn: apiFetch({
      apiRoute: getQueuesTableApiRoute,
      body: {
        cursor: options.cursor,
        search: options.search,
        limit: 20,
      },
    }),
  });

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
              <TableHead>Scheduler</TableHead>
              <TableHead>Active Jobs</TableHead>
              <TableHead>Failed Jobs</TableHead>
              <TableHead>Completed Jobs</TableHead>
              <TableHead>Workers</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.queues.map((queue) => (
              <TableRow key={queue.name}>
                <TableCell className="font-medium">{queue.name}</TableCell>
                <TableCell>
                  <Badge variant={queue.isPaused ? "secondary" : "default"}>
                    {queue.isPaused ? "Paused" : "Running"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      queue.pattern || queue.every ? "default" : "outline"
                    }
                  >
                    {queue.pattern ||
                      (queue.every &&
                        `Every ${formatDuration({
                          seconds: queue.every / 1000,
                        })}`)}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  <span className="font-mono">{queue.activeJobs}</span>
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
