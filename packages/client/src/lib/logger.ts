import { AsyncLocalStorage } from "node:async_hooks"

import type { Job, SandboxedJob } from "bullmq"

import type { JobLogSyncEventInput } from "./log-events"

// oxlint-disable-next-line eslint/no-control-regex -- matches ANSI escape sequences (ESC) to strip colors from the logs
const ansiRegex = /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g

export function decolorize(input: string): string {
  return input.replace(ansiRegex, "")
}

let lastTs = 0
let counter = 0

function nextLogTimestamp() {
  const now = Date.now()
  if (now === lastTs) {
    counter++
  } else {
    lastTs = now
    counter = 0
  }
  return { ts: now, seq: counter }
}

// An Error cause keeps its `Error: message` form (no recursion through cyclic causes); other causes are formatted
// like any logged value rather than as `[object Object]`.
const formatCause = (cause: unknown) =>
  cause instanceof Error ? String(cause) : formatForLogger(cause)

export function formatForLogger(data: unknown): string {
  if (data instanceof Error)
    return data.stack
      ? `${data.stack}${data.cause ? `\n${formatCause(data.cause)}` : ""}`
      : data.message
  if (typeof data === "object" && data !== null) {
    try {
      return JSON.stringify(data, null, 2)
    } catch {
      return safeStringify(data)
    }
  }
  if (typeof data === "function") return `[Function: ${data.name || "anonymous"}]`
  return String(data)
}

function safeStringify(obj: unknown): string {
  const seen = new WeakSet()
  return JSON.stringify(
    obj,
    (_k, v: unknown) => {
      if (typeof v === "object" && v !== null) {
        if (seen.has(v)) return "[Circular]"
        seen.add(v)
      }
      return v
    },
    2,
  )
}

type Ctx = {
  job: Job | SandboxedJob
  emitBBBLog: (event: JobLogSyncEventInput) => Promise<void>
  autoEmitJobLogs?: boolean
  autoEmitBBBLogs?: boolean
  id: string
}
const jobStore = new AsyncLocalStorage<Ctx>()

let patched = false

/**
 * Patch console once. It will forward logs to the *current* job
 * if one is set in AsyncLocalStorage, otherwise just logs normally.
 */
export function installConsoleRelay({
  addPendingPublish,
  removePendingPublish,
}: {
  addPendingPublish: (publish: Promise<number | void>) => void
  removePendingPublish: (publish: Promise<number | void>) => void
}) {
  if (patched) return
  patched = true

  const original = {
    debug: console.debug.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    log: console.log.bind(console),
  } as const

  const forward =
    (level: keyof typeof original) =>
    (...params: unknown[]) => {
      const ctx = jobStore.getStore()
      if (ctx?.job) {
        const message = params
          .map((p) => (typeof p === "string" ? decolorize(p) : formatForLogger(p)))
          .join(" ")
        // Fire-and-forget so console stays sync; swallow errors.
        if (ctx.autoEmitBBBLogs && ctx.job.id) {
          const { ts, seq } = nextLogTimestamp()
          const p = ctx
            .emitBBBLog({
              jobId: ctx.job.id,
              queueName: ctx.job.queueName,
              logTimestamp: ts,
              logSeq: seq,
              jobTimestamp: ctx.job.timestamp,
              message,
              level,
            })
            .catch((err: unknown) => original.error("🔍 Error writing log to Redis stream", err))
          addPendingPublish(p)
          void p.finally(() => removePendingPublish(p))
        }
        if (ctx.autoEmitJobLogs) {
          try {
            void ctx.job.log(message)
          } catch (e) {
            original.error("🔍 Error forwarding log to job", e)
          }
        }
      }
      original[level](...(params as []))
    }

  console.debug = forward("debug")
  console.info = forward("info")
  console.warn = forward("warn")
  console.error = forward("error")
  console.log = forward("log")
}

/**
 * Run a function with the given job bound to the async context,
 * so any console.* within (including in awaited calls) is attributed correctly.
 */
export function withJobConsole<T>(ctx: Ctx, fn: () => T | Promise<T>): T | Promise<T> {
  return jobStore.run(ctx, fn)
}
