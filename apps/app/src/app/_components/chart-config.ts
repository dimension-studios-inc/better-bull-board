/**
 * Resize debounce for the dashboard charts: the sidebar collapse animates the content width for 200ms, and
 * re-rendering every chart on each frame of it dropped frames. Charts resize once the animation is done.
 */
export const CHART_RESIZE_DEBOUNCE_MS = 200

// Graph buckets go from 10 seconds (last 5 minutes) to 1 day (last 30 days)
export const getTimeFormats = (minutes: number) => {
  if (minutes <= 15) return { axis: "HH:mm:ss", tooltip: "HH:mm:ss" }
  if (minutes <= 12 * 60) return { axis: "HH:mm", tooltip: "HH:mm" }
  if (minutes <= 7 * 24 * 60) return { axis: "EEEEEE HH:mm", tooltip: "EEEEEE HH:mm" }
  return { axis: "MMM dd", tooltip: "MMM dd, yyyy" }
}
