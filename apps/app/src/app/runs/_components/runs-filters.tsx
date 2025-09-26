"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { getQueuesTableApiRoute } from "~/app/api/queues/table/schemas";
import { Card, CardContent } from "~/components/ui/card";
import { Combobox, type ComboboxOption } from "~/components/ui/combobox";
import { Input } from "~/components/ui/input";
import { apiFetch } from "~/lib/utils";
import type { TRunFilters } from "./types";

export function RunsFilters({
  filters,
  setFilters,
}: {
  filters: TRunFilters;
  setFilters: React.Dispatch<React.SetStateAction<TRunFilters>>;
}) {
  const [queueOpen, setQueueOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [queueSearch, setQueueSearch] = useState("");
  const [statusSearch, setStatusSearch] = useState("");

  const { data: queues } = useInfiniteQuery({
    queryKey: ["queues/table", queueSearch],
    queryFn: ({ pageParam }: { pageParam: string | null }) =>
      apiFetch({
        apiRoute: getQueuesTableApiRoute,
        body: { search: queueSearch, cursor: pageParam },
      })(),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: null,
  });

  // TODO: add infinite scroll
  const queueOptions: ComboboxOption[] = useMemo(() => {
    const options = [{ value: "all", label: "All Queues" }];
    if (queues) {
      queues.pages.forEach((page) => {
        page.queues.forEach((queue) => {
          options.push({ value: queue.name, label: queue.name });
        });
      });
    }
    return options;
  }, [queues]);

  const statusOptions: ComboboxOption[] = [
    { value: "all", label: "All Statuses" },
    { value: "completed", label: "Completed" },
    { value: "failed", label: "Failed" },
    { value: "active", label: "Active" },
  ];

  const renderQueueValue = (value: string) => {
    const option = queueOptions.find((opt) => opt.value === value);
    return option ? option.label : "All Queues";
  };

  const renderStatusValue = (value: string) => {
    const option = statusOptions.find((opt) => opt.value === value);
    return option ? option.label : "All Statuses";
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by job ID, name, or error..."
                value={filters.search}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, search: e.target.value }))
                }
                className="pl-10"
              />
            </div>
          </div>

          <Combobox
            value={filters.queue}
            onValueChange={(value) =>
              setFilters((prev) => ({ ...prev, queue: value }))
            }
            options={queueOptions}
            placeholder="All Queues"
            noOptionsMessage="No queues found"
            searchPlaceholder="Search queues..."
            search={queueSearch}
            setSearch={setQueueSearch}
            open={queueOpen}
            setOpen={setQueueOpen}
            renderValue={renderQueueValue}
            className="w-48"
          />

          <Combobox
            value={filters.status}
            onValueChange={(value) =>
              setFilters((prev) => ({ ...prev, status: value }))
            }
            options={statusOptions}
            placeholder="All Statuses"
            noOptionsMessage="No statuses found"
            searchPlaceholder="Search statuses..."
            search={statusSearch}
            setSearch={setStatusSearch}
            open={statusOpen}
            setOpen={setStatusOpen}
            renderValue={renderStatusValue}
            className="w-48"
          />
        </div>
      </CardContent>
    </Card>
  );
}
