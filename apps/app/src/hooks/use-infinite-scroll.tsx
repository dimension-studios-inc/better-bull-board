import { type RefObject, useCallback, useEffect, useRef } from "react";

interface UseInfiniteScrollOptions {
  /**
   * Callback to fetch the next page
   */
  fetchNextPage: () => void;
  /**
   * Whether there is a next page to fetch
   */
  hasNextPage: boolean;
  /**
   * Whether the next page is currently being fetched
   */
  isFetchingNextPage: boolean;
  /**
   * How far from the viewport the loader should be when triggering the fetch (in pixels)
   * Format: "top right bottom left" (similar to CSS margin)
   * @default "50px 0px 0px 0px"
   */
  rootMargin?: string;
  /**
   * Ref for the loader element
   */
  loaderRef?: RefObject<
    HTMLDivElement | HTMLTableCellElement | HTMLLIElement | null
  >;
  /**
   * State to watch for changes
   */
  watchState?: unknown[];
  /**
   * Enable infinite scroll
   */
  enabled?: boolean;
}

/**
 * Hook for implementing infinite scrolling with an intersection observer
 *
 * @example
 * ```tsx
 * const { loaderRef } = useInfiniteScroll({
 *   fetchNextPage,
 *   hasNextPage,
 *   isFetchingNextPage,
 * })
 *
 * return (
 *   <>
 *     <div>Content</div>
 *     {hasNextPage && (
 *       <div ref={loaderRef}>
 *         <Loader />
 *       </div>
 *     )}
 *   </>
 * )
 * ```
 */
export function useInfiniteScroll({
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
  rootMargin = "0px",
  loaderRef,
  watchState,
  enabled = true,
}: UseInfiniteScrollOptions) {
  // Create a ref for the loader element
  const localLoaderRef = useRef<HTMLDivElement | HTMLTableCellElement | null>(
    null,
  );
  const observerRef = useRef<IntersectionObserver | null>(null);
  const _loaderRef = loaderRef ?? localLoaderRef;

  const setupWatcher = useCallback(async () => {
    let currentLoaderRef = _loaderRef.current;

    if (!currentLoaderRef) {
      // Auto retry before logging
      await new Promise((resolve) => setTimeout(resolve, 100));
      currentLoaderRef = _loaderRef.current;
    }

    // Debug information
    if (!currentLoaderRef) {
      console.warn(
        "Loader ref is not initialized. Make sure the ref is properly attached to a DOM element.",
      );
      return;
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        // If the loader is intersecting and we have a next page, fetch it
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      {
        rootMargin,
      },
    );

    // Start observing the loader element
    observerRef.current.observe(currentLoaderRef);
  }, [
    hasNextPage,
    isFetchingNextPage,
    rootMargin,
    _loaderRef,
    ...(watchState ?? []),
    fetchNextPage,
  ]);

  // Set up the intersection observer
  useEffect(() => {
    if (!enabled) return;

    setupWatcher();

    return () => {
      observerRef.current?.disconnect();
    };
  }, [setupWatcher, enabled]);

  return { loaderRef: _loaderRef };
}
