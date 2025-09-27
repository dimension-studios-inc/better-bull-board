"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Filter, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { getQueuesTableApiRoute } from "~/app/api/queues/table/schemas";
import { getTagsApiRoute } from "~/app/api/tags/schemas";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Combobox, type ComboboxOption } from "~/components/ui/combobox";
import { Input } from "~/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { useInfiniteScroll } from "~/hooks/use-infinite-scroll";
import { apiFetch } from "~/lib/utils/client";
import type { TRunFilters } from "./types";

export function RunsFilters({
  filters,
  setFilters,
  runs,
  startEndContent,
}: {
  filters: TRunFilters;
  setFilters: (
    filters: Partial<
      Pick<TRunFilters, "queue" | "status" | "search" | "tags" | "cursor">
    >,
  ) => void;
  runs?: {
    nextCursor: number | null;
    prevCursor: number | null;
  };
  startEndContent?: React.ReactNode;
}) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [queueSearch, setQueueSearch] = useState("");
  const [statusSearch, setStatusSearch] = useState("");
  const [tagsSearch, setTagsSearch] = useState("");

  const {
    data: queues,
    isLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
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

  const { loaderRef } = useInfiniteScroll({
    fetchNextPage: fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    watchState: [queueOpen],
    enabled: queueOpen,
  });

  const { data: tagsData } = useQuery({
    queryKey: ["tags", tagsSearch],
    queryFn: apiFetch({
      apiRoute: getTagsApiRoute,
      body: { search: tagsSearch },
    }),
    enabled: tagsOpen || tagsSearch.length > 0,
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

  const tagsOptions: ComboboxOption[] = useMemo(() => {
    if (!tagsData?.tags) return [];
    return tagsData.tags.map((tag) => ({ value: tag, label: tag }));
  }, [tagsData]);

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

    if (filters.tags && filters.tags.length > 0) {
      filters.tags.forEach((tag) => {
        activeFilters.push({
          key: "tags",
          label: tag,
          value: tag,
        });
      });
    }

    return activeFilters;
  };

  const removeFilter = (filterKey: string, filterValue?: string) => {
    if (filterKey === "tags" && filterValue) {
      const newTags = filters.tags.filter((tag) => tag !== filterValue);
      setFilters({
        cursor: null,
        tags: newTags,
      });
    } else {
      setFilters({
        cursor: null,
        [filterKey]: filterKey === "queue" || filterKey === "status" ? "all" : filterKey === "tags" ? [] : "",
      });
    }
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
    } else {
      setFilters({ cursor: null });
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
                    infiniteLoadingProps={{
                      hasNextPage,
                      fetchNextPage,
                      isFetchingNextPage,
                      loaderRef: loaderRef as React.RefObject<HTMLDivElement>,
                    }}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Status
                  </label>
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
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Tags
                  </label>
                  <div className="space-y-2">
                    {filters.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {filters.tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="size-3 p-0 ml-1 hover:bg-transparent"
                              onClick={() => {
                                const newTags = filters.tags.filter((t) => t !== tag);
                                setFilters({ tags: newTags });
                              }}
                            >
                              <X className="size-2" />
                            </Button>
                          </Badge>
                        ))}
                      </div>
                    )}
                    <Combobox
                      value=""
                      onValueChange={(value) => {
                        if (value && !filters.tags.includes(value)) {
                          setFilters({ tags: [...filters.tags, value] });
                        }
                        setTagsSearch("");
                      }}
                      options={tagsOptions.filter((option) => !filters.tags.includes(option.value))}
                      placeholder="Add tags..."
                      noOptionsMessage="No tags found"
                      searchPlaceholder="Search tags..."
                      search={tagsSearch}
                      setSearch={setTagsSearch}
                      open={tagsOpen}
                      setOpen={setTagsOpen}
                      renderValue={() => ""}
                      className="w-full"
                    />
                  </div>
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
        <div className="flex-1 relative w-[350px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by job ID, name, or error..."
            value={filters.search}
            onChange={(e) => setFilters({ search: e.target.value })}
            className="pl-10"
          />
        </div>
        {activeFilters.map((filter, index) => (
          <Badge key={`${filter.key}-${index}`} variant="secondary" className="h-9 px-2">
            {filter.label}
            <Button
              variant="ghost"
              size="sm"
              className="size-4 p-0 hover:bg-transparent"
              onClick={() => removeFilter(filter.key, filter.value)}
            >
              <X className="size-3" />
            </Button>
          </Badge>
        ))}
        {startEndContent}
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handlePrevPage}
          disabled={isLoading || (!runs?.prevCursor && !filters.cursor)}
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
