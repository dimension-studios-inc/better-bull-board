"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Filter, Pause, Play, Plus, Search, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { getTagsApiRoute } from "~/app/api/tags/schemas";
import { QueueSelector } from "~/components/queue-selector";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Combobox, type ComboboxOption } from "~/components/ui/combobox";
import { Input } from "~/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import useDebounce from "~/hooks/use-debounce";
import { apiFetch } from "~/lib/utils/client";
import type { TRunFilters, TRunFilterUpdate } from "./types";

const MIN_TAG_SEARCH_LENGTH = 2;

const formatCreatedFilterLabel = (value: string) => value.replace("T", " ");

const getCreatedInputValue = (value: string, fallbackTime: string) =>
  value && !value.includes("T") ? `${value}T${fallbackTime}` : value;

export function RunsFilters({
  filters,
  setFilters,
  runs,
  isFetching,
  liveUpdatesPaused,
  onLiveUpdatesPausedChange,
  startEndContent,
}: {
  filters: TRunFilters;
  setFilters: (filters: TRunFilterUpdate) => void;
  runs?: {
    nextCursor: { createdAt: Date; jobId: string; id: string; durationMs?: number | null } | null;
    prevCursor: { createdAt: Date; jobId: string; id: string; durationMs?: number | null } | null;
  };
  isFetching?: boolean;
  liveUpdatesPaused: boolean;
  onLiveUpdatesPausedChange: (paused: boolean) => void;
  startEndContent?: React.ReactNode;
}) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [queueSearch, setQueueSearch] = useState("");
  const [statusSearch, setStatusSearch] = useState("");
  const [tagsSearch, setTagsSearch] = useState("");

  const debouncedTagsSearch = useDebounce(tagsSearch, 250);

  const { data: tagsData, isFetching: isTagsFetching } = useQuery({
    queryKey: ["tags", debouncedTagsSearch],
    queryFn: apiFetch({
      apiRoute: getTagsApiRoute,
      body: { search: debouncedTagsSearch },
    }),
    enabled: tagsOpen && debouncedTagsSearch.length >= MIN_TAG_SEARCH_LENGTH,
  });

  const statusOptions: ComboboxOption[] = [
    { value: "all", label: "All Statuses" },
    { value: "completed", label: "Completed" },
    { value: "failed", label: "Failed" },
    { value: "active", label: "Active" },
    { value: "waiting", label: "Waiting" },
    { value: "delayed", label: "Delayed" },
    { value: "prioritized", label: "Prioritized" },
    { value: "waiting-children", label: "Waiting Children" },
    { value: "unknown", label: "Unknown" },
  ];

  const tagsOptions: ComboboxOption[] = useMemo(() => {
    if (!tagsData?.tags) return [];
    return tagsData.tags.map((tag) => ({ value: tag, label: tag }));
  }, [tagsData]);

  const renderStatusValue = (value: string) => {
    const option = statusOptions?.find((opt) => opt.value === value);
    return option ? option.label : "All Statuses";
  };

  const getActiveFilters = () => {
    const activeFilters = [];

    if (filters.queue && filters.queue !== "all") {
      activeFilters.push({
        key: "queue",
        label: filters.queue,
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

    if (filters.createdFrom) {
      activeFilters.push({
        key: "createdFrom",
        label: `Created from ${formatCreatedFilterLabel(filters.createdFrom)}`,
        value: filters.createdFrom,
      });
    }

    if (filters.createdTo) {
      activeFilters.push({
        key: "createdTo",
        label: `Created to ${formatCreatedFilterLabel(filters.createdTo)}`,
        value: filters.createdTo,
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
      return;
    }

    if (filterKey === "queue") {
      setFilters({ cursor: null, queue: "all" });
      return;
    }

    if (filterKey === "status") {
      setFilters({ cursor: null, status: "all" });
      return;
    }

    if (filterKey === "tags") {
      setFilters({ cursor: null, tags: [] });
      return;
    }

    if (filterKey === "createdFrom") {
      setFilters({ cursor: null, createdFrom: "" });
      return;
    }

    if (filterKey === "createdTo") {
      setFilters({ cursor: null, createdTo: "" });
      return;
    }

    setFilters({ cursor: null, search: "" });
  };

  const activeFilters = getActiveFilters();

  //* Pagination
  const handleNextPage = () => {
    if (runs?.nextCursor) {
      setFilters({
        cursor: {
          ...runs.nextCursor,
          createdAt: runs.nextCursor.createdAt.getTime(),
        },
        cursorDirection: "next",
      });
    }
  };

  const handlePrevPage = () => {
    if (runs?.prevCursor) {
      setFilters({
        cursor: {
          ...runs.prevCursor,
          createdAt: runs.prevCursor.createdAt.getTime(),
        },
        cursorDirection: "prev",
      });
    } else {
      setFilters({ cursor: null, cursorDirection: "next" });
    }
  };

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-1 bg-transparent">
              <Filter className="h-4 w-4" />
              Filters
              {activeFilters.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 min-w-5 text-xs">
                  {activeFilters.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="p-4 w-max" align="start">
            <div className="space-y-4 w-80">
              <div className="font-medium text-sm">Filter Options</div>

              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium mb-2 block">Queue</label>
                  <QueueSelector
                    value={filters.queue}
                    onValueChange={(value) => setFilters({ queue: value })}
                    search={queueSearch}
                    setSearch={setQueueSearch}
                    open={queueOpen}
                    setOpen={setQueueOpen}
                    placeholder="All Queues"
                    className="w-full"
                    popoverContentClassName="w-80"
                    includeAllOption={true}
                    allOptionLabel="All Queues"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Status</label>
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
                    popoverContentClassName="w-80"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Tags</label>
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
                      placeholder="Type to search tags..."
                      noOptionsMessage={
                        debouncedTagsSearch.length < MIN_TAG_SEARCH_LENGTH
                          ? "Type at least 2 characters"
                          : "No tags found"
                      }
                      searchPlaceholder="Search tags..."
                      search={tagsSearch}
                      setSearch={setTagsSearch}
                      open={tagsOpen}
                      setOpen={setTagsOpen}
                      renderValue={() => ""}
                      className="w-full"
                      isFetching={isTagsFetching}
                      popoverContentClassName="w-80"
                    />
                    <div className="text-xs text-muted-foreground">Start typing to search (2+ chars).</div>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Created</label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="datetime-local"
                      step={1}
                      value={getCreatedInputValue(filters.createdFrom, "00:00")}
                      onChange={(event) => setFilters({ createdFrom: event.target.value })}
                      aria-label="Created from"
                    />
                    <Input
                      type="datetime-local"
                      step={1}
                      value={getCreatedInputValue(filters.createdTo, "23:59")}
                      onChange={(event) => setFilters({ createdTo: event.target.value })}
                      aria-label="Created to"
                    />
                  </div>
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
        <div className="flex-1 relative w-96">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by job ID, name, or error..."
            value={filters.search}
            onChange={(e) => setFilters({ search: e.target.value })}
            className="pl-10"
          />
        </div>
        {activeFilters.map((filter) => (
          <Badge key={`${filter.key}-${filter.value}`} variant="secondary" className="h-9 px-2">
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
          onClick={() => onLiveUpdatesPausedChange(!liveUpdatesPaused)}
          className="size-9 p-0"
          aria-pressed={liveUpdatesPaused}
          aria-label={liveUpdatesPaused ? "Resume live updates" : "Pause live updates"}
          title={liveUpdatesPaused ? "Resume live updates" : "Pause live updates"}
        >
          {liveUpdatesPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
        </Button>
        <Button asChild size="sm" className="gap-1">
          <Link href="/runs/create">
            <Plus className="h-4 w-4" />
            Create Run
          </Link>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handlePrevPage}
          disabled={isFetching || (!runs?.prevCursor && !filters.cursor)}
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>
        <Button variant="outline" size="sm" onClick={handleNextPage} disabled={isFetching || !runs?.nextCursor}>
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
