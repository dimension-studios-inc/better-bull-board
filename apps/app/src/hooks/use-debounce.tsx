"use client";

import { useEffect, useState } from "react";

/**
 * A custom React Hook that debounces a value.
 *
 * This hook delays updating the `debouncedValue` until after the specified
 * `delay` has passed since the last time the `value` changed. It's commonly
 * used to prevent rapid firing of events such as API calls when the user is
 * typing in an input field.
 *
 * @param value - The value to debounce.
 * @param delay - The delay in milliseconds.
 * @returns The debounced value.
 */
function useDebounce<T>(value: T, delay: number = 250): T {
  // Use functional update to ensure proper initialization with functions
  const [debouncedValue, setDebouncedValue] = useState<T>(() => value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default useDebounce;
