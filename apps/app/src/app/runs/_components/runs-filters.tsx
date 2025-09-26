"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Filter, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { getQueuesTableApiRoute } from "~/app/api/queues/table/schemas";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Combobox, type ComboboxOption } from "~/components/ui/combobox";
import { Input } from "~/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { apiFetch } from "~/lib/utils/client";
import type { TRunFilters } from "./types";

export function RunsFilters({
  filters,
  setFilters,
  runs,
}: {
  filters: TRunFilters;
  setFilters: (
    filters: Partial<
      Pick<TRunFilters, "queue" | "status" | "search" | "cursor">
    >,
  ) => void;
  runs?: {
    nextCursor: number | null;
    prevCursor: number | null;
  };
}) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [queueSearch, setQueueSearch] = useState("");
  const [statusSearch, setStatusSearch] = useState("");

  const { data: queues, isLoading } = useInfiniteQuery({
    queryKey: ["queues/table", queueSearch],
    queryFn: ({ pageParam }: { pageParam: string | null }) =>
      apiFetch({
        apiRoute: getQueuesTableApiRoute,
        body: {
          search: queueSearch,
          cursor: pageParam,
          timePeriod: "1",
        },
      })(),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: null,
  });

  const queueOptions: ComboboxOption[] = useMemo(() => {
    const options = [{ value: "all", label: "All Queues" }];
    if (queues?.pages) {
      queues.pages.forEach((page) => {
        if (page?.queues) {
          page.queues.forEach((queue) => {
            options.push({ value: queue.name, label: queue.name });
          });
        }
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
    const option = queueOptions?.find((opt) => opt.value === value);
    return option ? option.label : isLoading ? "Loading..." : "";
  };

  const renderStatusValue = (value: string) => {
    const option = statusOptions?.find((opt) => opt.value === value);
    return option ? option.label : "All Statuses";
  };

  const getActiveFilters = () => {
    const activeFilters = [];

    if (filters.queue && filters.queue !== "all") {
      activeFilters.push({
        key: "queue",
        label: renderQueueValue(filters.queue),
        value: filters.queue,
      });
    }

    if (filters.status && filters.status !== "all") {
      activeFilters.push({
        key: "status",
        label: renderStatusValue(filters.status),
        value: filters.status,
      });
    }

    return activeFilters;
  };

  const removeFilter = (filterKey: string) => {
    setFilters({
      cursor: null,
      [filterKey]: filterKey === "queue" || filterKey === "status" ? "all" : "",
    });
  };

  const activeFilters = getActiveFilters();

  //* Pagination
  const handleNextPage = () => {
    if (runs?.nextCursor) {
      setFilters({ cursor: runs.nextCursor });
    }
  };

  const handlePrevPage = () => {
    if (runs?.prevCursor) {
      setFilters({ cursor: runs.prevCursor });
    }
  };

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1 bg-transparent"
            >
              <Filter className="h-4 w-4" />
              Filters
              {activeFilters.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 min-w-5 text-xs">
                  {activeFilters.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-4" align="end">
            <div className="space-y-4">
              <div className="font-medium text-sm">Filter Options</div>

              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Queue
                  </label>
                  <Combobox
                    value={filters.queue}
                    onValueChange={(value) => setFilters({ queue: value })}
                    options={queueOptions}
                    placeholder="All Queues"
                    noOptionsMessage="No queues found"
                    searchPlaceholder="Search queues..."
                    search={queueSearch}
                    setSearch={setQueueSearch}
                    open={queueOpen}
                    setOpen={setQueueOpen}
                    renderValue={renderQueueValue}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Status
                    <Combobox
                      value={filters.status}
                      onValueChange={(value) => setFilters({ status: value })}
                      options={statusOptions}
                      placeholder="All Statuses"
                      noOptionsMessage="No statuses found"
                      searchPlaceholder="Search statuses..."
                      search={statusSearch}
                      setSearch={setStatusSearch}
                      open={statusOpen}
                      setOpen={setStatusOpen}
                      renderValue={renderStatusValue}
                      className="w-full"
                    />
                  </label>
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
        <div className="flex-1 relative max-w-[350px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by job ID, name, or error..."
            value={filters.search}
            onChange={(e) => setFilters({ search: e.target.value })}
            className="pl-10"
          />
        </div>
        {activeFilters.map((filter) => (
          <Badge key={filter.key} variant="secondary" className="h-9 px-2">
            {filter.label}
            <Button
              variant="ghost"
              size="sm"
              className="size-4 p-0 hover:bg-transparent"
              onClick={() => removeFilter(filter.key)}
            >
              <X className="size-3" />
            </Button>
          </Badge>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handlePrevPage}
          disabled={isLoading || !runs?.prevCursor}
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleNextPage}
          disabled={isLoading || !runs?.nextCursor}
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
