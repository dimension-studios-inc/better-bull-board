/** Short duration label, keeping milliseconds for fast jobs */
export const formatDurationMs = (ms: number) => {
  if (ms < 1000) return `${Math.round(ms)}ms`
  if (ms < 60 * 1000) return `${(ms / 1000).toFixed(1)}s`
  if (ms < 60 * 60 * 1000) return `${(ms / (60 * 1000)).toFixed(1)}m`
  return `${(ms / (60 * 60 * 1000)).toFixed(1)}h`
}
