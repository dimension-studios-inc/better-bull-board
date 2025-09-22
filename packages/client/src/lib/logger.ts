import { AsyncLocalStorage } from "node:async_hooks";
import type { Job } from "bullmq";

// biome-ignore lint/suspicious/noControlCharactersInRegex: we don't want to colorize the logs
const ansiRegex = /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g;

export function decolorize(input: string): string {
  return input.replace(ansiRegex, "");
}

export function formatForLogger(data: unknown): string {
  if (data instanceof Error)
    return data.stack
      ? `${data.stack}${data.cause ? `\n${data.cause}` : ""}`
      : data.message;
  if (typeof data === "object" && data !== null) {
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return safeStringify(data);
    }
  }
  if (typeof data === "function")
    return `[Function: ${data.name || "anonymous"}]`;
  return String(data);
}

function safeStringify(obj: unknown): string {
  const seen = new WeakSet();
  return JSON.stringify(
    obj,
    (_k, v) => {
      if (typeof v === "object" && v !== null) {
        if (seen.has(v)) return "[Circular]";
        seen.add(v);
      }
      return v;
    },
    2,
  );
}

type Ctx = {
  job: Job;
  publish: (channel: string, message: string) => void;
  autoEmitJobLogs?: boolean;
  autoEmitBBBLogs?: boolean;
  id: string;
};
const jobStore = new AsyncLocalStorage<Ctx>();

let patched = false;

/**
 * Patch console once. It will forward logs to the *current* job
 * if one is set in AsyncLocalStorage, otherwise just logs normally.
 */
export function installConsoleRelay() {
  if (patched) return;
  patched = true;

  const original = {
    debug: console.debug.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    log: console.log.bind(console),
  } as const;

  const forward =
    (level: keyof typeof original) =>
    (...params: unknown[]) => {
      const ctx = jobStore.getStore();
      if (ctx?.job) {
        const message = params
          .map((p) =>
            typeof p === "string" ? decolorize(p) : formatForLogger(p),
          )
          .join(" ");
        // Fire-and-forget so console stays sync; swallow errors.
        if (ctx.autoEmitBBBLogs) {
          ctx.publish(
            "bbb:worker:job:log",
            JSON.stringify({
              id: ctx.id,
              jobId: ctx.job.id,
              message,
              level,
            }),
          );
        }
        if (ctx.autoEmitJobLogs) {
          void ctx.job.log(message).catch(() => {});
        }
      }
      original[level](...(params as []));
    };

  console.debug = forward("debug");
  console.info = forward("info");
  console.warn = forward("warn");
  console.error = forward("error");
  console.log = forward("log");
}

/**
 * Run a function with the given job bound to the async context,
 * so any console.* within (including in awaited calls) is attributed correctly.
 */
export function withJobConsole<T>(
  ctx: Ctx,
  fn: () => T | Promise<T>,
): T | Promise<T> {
  return jobStore.run(ctx, fn);
}
