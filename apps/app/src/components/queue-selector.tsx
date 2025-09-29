"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { getQueuesNameApiRoute } from "~/app/api/queues/name/schemas";
import { Combobox, type ComboboxOption } from "~/components/ui/combobox";
import { useInfiniteScroll } from "~/hooks/use-infinite-scroll";
import { apiFetch } from "~/lib/utils/client";

interface QueueSelectorProps {
  value: string;
  onValueChange: (value: string) => void;
  search: string;
  setSearch: (search: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  placeholder?: string;
  className?: string;
  popoverContentClassName?: string;
  renderValue?: (value: string) => string;
  includeAllOption?: boolean;
  allOptionLabel?: string;
}

export function QueueSelector({
  value,
  onValueChange,
  search,
  setSearch,
  open,
  setOpen,
  placeholder = "Select a queue...",
  className,
  popoverContentClassName,
  renderValue,
  includeAllOption = false,
  allOptionLabel = "All Queues",
}: QueueSelectorProps) {
  const {
    data: queues,
    isLoading,
    isFetching: isQueuesFetching,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["queues/name", search],
    queryFn: ({ pageParam }: { pageParam: string | null }) =>
      apiFetch({
        apiRoute: getQueuesNameApiRoute,
        body: {
          search,
          cursor: pageParam,
        },
      })(),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: null,
  });

  const { loaderRef } = useInfiniteScroll({
    fetchNextPage: fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    watchState: [open],
    enabled: open,
  });

  const queueOptions: ComboboxOption[] = useMemo(() => {
    const options = includeAllOption
      ? [{ value: "all", label: allOptionLabel }]
      : [];
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
  }, [queues, includeAllOption, allOptionLabel]);

  const defaultRenderValue = (value: string) => {
    const option = queueOptions?.find((opt) => opt.value === value);
    return option ? option.label : isLoading ? "Loading..." : "";
  };

  return (
    <Combobox
      value={value}
      onValueChange={onValueChange}
      options={queueOptions}
      placeholder={placeholder}
      noOptionsMessage="No queues found"
      searchPlaceholder="Search queues..."
      search={search}
      setSearch={setSearch}
      open={open}
      setOpen={setOpen}
      renderValue={renderValue || defaultRenderValue}
      className={className}
      isFetching={isQueuesFetching}
      infiniteLoadingProps={{
        hasNextPage,
        fetchNextPage,
        isFetchingNextPage,
        loaderRef: loaderRef as React.RefObject<HTMLDivElement>,
      }}
      popoverContentClassName={popoverContentClassName}
    />
  );
}
