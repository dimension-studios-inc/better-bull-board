import type { JobLogSyncLevel } from "./log-events"
import { formatForLogger, hasJobContext, relayJobLog } from "./logger"

type PinoLine = Record<string, unknown>

const isRecord = (value: unknown): value is PinoLine =>
  typeof value === "object" && value !== null && !Array.isArray(value)

// pino's default numeric levels: trace 10, debug 20, info 30, warn 40, error 50, fatal 60.
const levelFromNumber = (level: number): JobLogSyncLevel =>
  level < 30 ? "debug" : level < 40 ? "info" : level < 50 ? "warn" : "error"

const levelFromLabel: Record<string, JobLogSyncLevel> = {
  trace: "debug",
  debug: "debug",
  info: "info",
  warn: "warn",
  error: "error",
  fatal: "error",
}

// `level` is a number by default and a label when `formatters.level` emits one.
const toJobLogLevel = (level: unknown): JobLogSyncLevel => {
  if (typeof level === "number") return levelFromNumber(level)
  if (typeof level === "string") return levelFromLabel[level] ?? "log"
  return "log"
}

// pino's err serializer emits `{ type, message, stack }`, the stack already carrying any cause.
const formatSerializedError = (err: unknown): string => {
  if (!isRecord(err)) return formatForLogger(err)
  return typeof err.stack === "string" ? err.stack : `${String(err.type)}: ${String(err.message)}`
}

const formatLine = (line: PinoLine, ignore: Set<string>): string => {
  const { level: _level, time: _time, msg, err, ...rest } = line
  const fields = Object.fromEntries(Object.entries(rest).filter(([key]) => !ignore.has(key)))
  const parts = [typeof msg === "string" ? msg : ""]
  if (Object.keys(fields).length > 0) parts.push(JSON.stringify(fields, null, 2))
  if (err !== undefined) parts.push(formatSerializedError(err))
  return parts.filter(Boolean).join("\n")
}

/**
 * A pino destination that relays every line to the current job's logs, like console output.
 * Pass it to `pino(options, destination)` or add it to a `pino.multistream`; `ignore` drops extra
 * keys (bindings such as a trace id) from the relayed message.
 */
export function createPinoJobLogDestination({ ignore = [] }: { ignore?: string[] } = {}) {
  const ignored = new Set(["pid", "hostname", ...ignore])
  return {
    write(line: string) {
      if (!hasJobContext()) return
      let parsed: unknown
      try {
        parsed = JSON.parse(line)
      } catch {
        relayJobLog({ level: "log", message: line.trimEnd() })
        return
      }
      if (!isRecord(parsed)) {
        relayJobLog({ level: "log", message: line.trimEnd() })
        return
      }
      relayJobLog({ level: toJobLogLevel(parsed.level), message: formatLine(parsed, ignored) })
    },
  }
}
