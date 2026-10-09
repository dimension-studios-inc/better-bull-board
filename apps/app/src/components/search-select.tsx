"use client"

import { Button } from "@better-bull-board/ui/components/button"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from "@better-bull-board/ui/components/combobox"
import { cn } from "cn"
import type * as React from "react"

import { Loader } from "~/components/loader"

export type SearchSelectOption = {
  value: string
  label: string
}

interface SearchSelectProps {
  /** Id of the trigger button, for a label */
  id?: string
  value: string
  onValueChange: (value: string) => void
  options: SearchSelectOption[]
  placeholder: string
  noOptionsMessage: string
  searchPlaceholder?: string
  search: string
  setSearch: (search: string) => void
  open: boolean
  setOpen: (open: boolean) => void
  renderValue: (value: string) => React.ReactNode
  isFetching?: boolean
  /** Shows a loader at the end of the list, attached to `loaderRef`, to load the next page when it scrolls into view */
  hasNextPage?: boolean
  loaderRef?: React.Ref<HTMLDivElement>
  className?: string
  popoverContentClassName?: string
}

/**
 * Select with a search input in its popup. Options are filtered by the caller (often server side), from `search`.
 */
export function SearchSelect({
  id,
  value,
  onValueChange,
  options,
  placeholder,
  noOptionsMessage,
  searchPlaceholder = "Search...",
  search,
  setSearch,
  open,
  setOpen,
  renderValue,
  isFetching,
  hasNextPage,
  loaderRef,
  className,
  popoverContentClassName,
}: SearchSelectProps) {
  // The selected value may be missing from the loaded (paginated / searched) options
  const selectedOption =
    options.find((option) => option.value === value) ?? (value ? { value, label: value } : null)

  return (
    <Combobox
      items={options}
      value={selectedOption}
      onValueChange={(option: SearchSelectOption | null) => onValueChange(option?.value ?? "")}
      inputValue={search}
      onInputValueChange={(inputValue) => setSearch(inputValue)}
      open={open}
      onOpenChange={(nextOpen) => setOpen(nextOpen)}
      filter={null}
      itemToStringLabel={(option: SearchSelectOption) => option.label}
      itemToStringValue={(option: SearchSelectOption) => option.value}
      isItemEqualToValue={(option: SearchSelectOption, selected: SearchSelectOption) =>
        option.value === selected.value
      }
    >
      <ComboboxTrigger
        render={
          <Button
            id={id}
            variant="outline"
            className={cn("w-[200px] justify-between font-normal", className)}
          />
        }
      >
        <span className={cn("truncate", !value && "text-muted-foreground")}>
          {value ? renderValue(value) : placeholder}
        </span>
      </ComboboxTrigger>
      <ComboboxContent className={popoverContentClassName}>
        <ComboboxInput placeholder={searchPlaceholder} showTrigger={false} />
        <ComboboxEmpty>{isFetching ? "Loading..." : noOptionsMessage}</ComboboxEmpty>
        <ComboboxList>
          {options.map((option) => (
            <ComboboxItem key={option.value} value={option}>
              {option.label}
            </ComboboxItem>
          ))}
          {hasNextPage && (
            <div ref={loaderRef} className="flex items-center justify-center py-2">
              <Loader />
            </div>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
