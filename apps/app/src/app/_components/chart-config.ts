/**
 * Resize debounce for the dashboard charts: the sidebar collapse animates the content width for 200ms, and
 * re-rendering every chart on each frame of it dropped frames. Charts resize once the animation is done.
 */
export const CHART_RESIZE_DEBOUNCE_MS = 200
