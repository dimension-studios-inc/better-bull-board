"use client";

import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { getQueuesNameApiRoute } from "~/app/api/queues/name/schemas";
import { Combobox, type ComboboxOption } from "~/components/ui/combobox";
import useDebounce from "~/hooks/use-debounce";
import { useInfiniteScroll } from "~/hooks/use-infinite-scroll";
import { apiFetch } from "~/lib/utils/client";

const getCustomQueueOptionLabel = (queueName: string) => `Use custom queue "${queueName}"`;

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
  allowCustomValue?: boolean;
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
  allowCustomValue = false,
}: QueueSelectorProps) {
  const debouncedSearch = useDebounce(search, 250);
  const {
    data: queues,
    isLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["queues/name", debouncedSearch],
    queryFn: ({ pageParam }: { pageParam: string | null }) =>
      apiFetch({
        apiRoute: getQueuesNameApiRoute,
        body: {
          search: debouncedSearch,
          cursor: pageParam,
        },
      })(),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: null,
    placeholderData: keepPreviousData,
  });

  const { loaderRef } = useInfiniteScroll({
    fetchNextPage: fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    watchState: [open],
    enabled: open,
  });

  const queueOptions: ComboboxOption[] = useMemo(() => {
    const options = includeAllOption ? [{ value: "all", label: allOptionLabel }] : [];
    const normalizedSearch = search.trim().toLowerCase();

    if (queues?.pages) {
      queues.pages.forEach((page) => {
        if (page?.queues) {
          page.queues.forEach((queue) => {
            if (normalizedSearch && !queue.name.toLowerCase().includes(normalizedSearch)) {
              return;
            }

            options.push({ value: queue.name, label: queue.name });
          });
        }
      });
    }
    const customQueueName = search.trim();
    const hasCustomQueueName = options.some((option) => option.value === customQueueName);

    if (allowCustomValue && customQueueName && !hasCustomQueueName) {
      options.push({
        value: customQueueName,
        label: getCustomQueueOptionLabel(customQueueName),
      });
    }

    return options;
  }, [queues, includeAllOption, allOptionLabel, allowCustomValue, search]);

  const defaultRenderValue = (value: string) => {
    const option = queueOptions?.find((opt) => opt.value === value);
    if (!option) {
      if (isLoading) return "Loading...";
      return allowCustomValue ? value : "";
    }

    return option.label === getCustomQueueOptionLabel(option.value) ? option.value : option.label;
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
      isFetching={isLoading}
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
