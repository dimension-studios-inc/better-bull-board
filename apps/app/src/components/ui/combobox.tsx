"use client";

import { CheckIcon, ChevronsUpDown } from "lucide-react";
import type * as React from "react";
import { Button } from "~/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { cn } from "~/lib/utils";
import { Loader } from "./loader";

export type ComboboxOption = {
  value: string;
  label: string;
};

export interface ComboboxProps {
  value: string;
  onValueChange: (value: string) => void;
  options: ComboboxOption[];
  className?: string;
  placeholder: string;
  noOptionsMessage: string;
  searchPlaceholder?: string;
  buttonProps?: React.ComponentProps<typeof Button>;
  search: string;
  setSearch: (search: string) => void;
  isLoading?: boolean;
  isFetching?: boolean;
  renderValue: (value: string) => React.ReactNode;
  infiniteLoadingProps?: {
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    fetchNextPage: () => void;
    loaderRef: React.RefObject<HTMLDivElement | null>;
  };
  open: boolean;
  setOpen: (open: boolean) => void;
  renderOption?: (option: ComboboxOption) => React.ReactNode;
  hideCheckIcon?: boolean;
}

export function Combobox({
  value,
  onValueChange,
  options,
  placeholder,
  noOptionsMessage,
  className,
  searchPlaceholder = "Search...",
  buttonProps,
  search,
  setSearch,
  isLoading,
  isFetching,
  renderValue,
  infiniteLoadingProps,
  open,
  setOpen,
  renderOption,
  hideCheckIcon,
}: ComboboxProps) {
  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button
          aria-expanded={open}
          role="combobox"
          variant={"outline"}
          {...buttonProps}
          className={cn("w-[200px] justify-between", className)}
          disabled={isLoading}
        >
          {isLoading ? "Loading..." : value ? renderValue(value) : placeholder}
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command shouldFilter={false}>
          <CommandInput
            onValueChange={setSearch}
            placeholder={searchPlaceholder}
            value={search}
          />
          <CommandList>
            {isFetching ? (
              <CommandEmpty>Loading...</CommandEmpty>
            ) : (
              <CommandEmpty>{noOptionsMessage}</CommandEmpty>
            )}
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  onSelect={(currentValue) => {
                    onValueChange(currentValue === value ? "" : currentValue);
                    setOpen(false);
                  }}
                  value={option.value}
                >
                  {!hideCheckIcon && (
                    <CheckIcon
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === option.value ? "opacity-100" : "opacity-0",
                      )}
                    />
                  )}
                  {renderOption ? renderOption(option) : option.label}
                </CommandItem>
              ))}
            </CommandGroup>
            {infiniteLoadingProps?.hasNextPage && (
              <CommandItem
                className="flex items-center justify-center"
                ref={infiniteLoadingProps.loaderRef}
                value="infinite-loading"
              >
                <Loader />
              </CommandItem>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
