import { useEffect, useState } from "react"

interface UseInfiniteScrollOptions {
  /**
   * Callback to fetch the next page
   */
  fetchNextPage: () => void
  /**
   * Whether there is a next page to fetch
   */
  hasNextPage: boolean
  /**
   * Whether the next page is currently being fetched
   */
  isFetchingNextPage: boolean
  /**
   * How far from the viewport the loader should be when triggering the fetch (in pixels)
   * Format: "top right bottom left" (similar to CSS margin)
   * @default "50px 0px 0px 0px"
   */
  rootMargin?: string
  /**
   * Enable infinite scroll
   */
  enabled?: boolean
}

/**
 * Hook for implementing infinite scrolling with an intersection observer. `loaderRef` is a callback ref to attach to
 * the loader element.
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
  enabled = true,
}: UseInfiniteScrollOptions) {
  // A callback ref kept in state, so the observer is set up whenever the loader element mounts (e.g. in a popover
  // that opens later) and torn down when it unmounts
  const [loader, setLoader] = useState<Element | null>(null)

  useEffect(() => {
    if (!enabled || !loader) return undefined

    const observer = new IntersectionObserver(
      (entries) => {
        // If the loader is intersecting and we have a next page, fetch it
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage()
        }
      },
      { rootMargin },
    )
    observer.observe(loader)

    return () => observer.disconnect()
  }, [loader, enabled, hasNextPage, isFetchingNextPage, rootMargin, fetchNextPage])

  const loaderRef: (element: Element | null) => void = setLoader
  return { loaderRef }
}
