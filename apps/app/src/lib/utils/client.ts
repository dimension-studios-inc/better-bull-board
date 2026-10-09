import { HttpError } from "@better-bull-board/core/errors"
import { formatDuration } from "date-fns"
import type { output, ZodType } from "zod"

export type TApiRoute = {
  route:
    | `/${string}`
    // `never` accepts any route builder regardless of its parameter type
    | ((input: never) => `/${string}`)
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "OPTIONS" | "HEAD"
  inputSchema?: ZodType | undefined
  urlSchema?: ZodType | undefined
  outputSchema: ZodType
}

const getApiErrorMessage = (body: unknown) =>
  typeof body === "object" && body !== null && "error" in body && typeof body.error === "string"
    ? body.error
    : undefined

export function apiFetch<
  R extends TApiRoute,
  IS extends R["inputSchema"],
  OS extends R["outputSchema"],
  US extends R["urlSchema"],
>({
  apiRoute,
  body,
  urlParams,
}: {
  apiRoute: R
  body: IS extends ZodType ? output<IS> : never
  urlParams?: US extends ZodType ? output<US> : never
}): () => Promise<output<OS>> {
  const inputSchema = apiRoute.inputSchema as IS
  const outputSchema = apiRoute.outputSchema as OS
  const urlSchema = apiRoute.urlSchema as US
  return async () => {
    const parsedBody = inputSchema?.parse(body)
    const parsedUrlParams = urlSchema?.parse(urlParams)
    const response = await fetch(
      typeof apiRoute.route === "function"
        ? apiRoute.route(parsedUrlParams as never)
        : apiRoute.route,
      {
        method: apiRoute.method,
        body: apiRoute.method === "GET" ? undefined : JSON.stringify(parsedBody),
        headers: apiRoute.method === "GET" ? {} : { "Content-Type": "application/json" },
        credentials: "include", // Include cookies for authentication
      },
    )
    if (!response.ok) {
      // API routes answer errors with `{ error }`, but a proxy may answer with an HTML page
      const errorBody: unknown = await response.json().catch(() => null)
      throw new HttpError(getApiErrorMessage(errorBody) ?? response.statusText, response.status)
    }
    const json: unknown = await response.json()
    return outputSchema.parse(json)
  }
}

export const registerApiRoute = <I extends ZodType, O extends ZodType, U extends ZodType>(params: {
  route: `/${string}` | ((input: output<U>) => `/${string}`)
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "OPTIONS" | "HEAD"
  inputSchema?: I
  urlSchema?: U
  outputSchema: O
}) => params

export function smartFormatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`
  }

  const totalSeconds = Math.round(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return formatDuration(
    { hours, minutes, seconds },
    {
      // You can control which units to include, whether zeros show, etc.
      // e.g. skip zero units
      zero: false,
      // For example: ["hours", "minutes", "seconds"] means only those units
      format: ["hours", "minutes", "seconds"],
      // delimiter between units
      delimiter: ", ",
    },
  )
}
