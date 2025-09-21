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

// biome-ignore lint/suspicious/noExplicitAny: we don't know the type of the log
function safeStringify(obj: any): string {
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
