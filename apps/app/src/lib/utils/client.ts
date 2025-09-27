import clsx, { type ClassValue } from "clsx";
import { formatDuration } from "date-fns";
import { twMerge } from "tailwind-merge";
import type { output, ZodType } from "zod";
import { env } from "../env";

export type TApiRoute = {
  route:
    | `/${string}`
    // biome-ignore lint/suspicious/noExplicitAny: hard to type
    | ((input: any) => `/${string}`);
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "OPTIONS" | "HEAD";
  inputSchema?: ZodType | undefined;
  urlSchema?: ZodType | undefined;
  outputSchema: ZodType;
};

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

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
  apiRoute: R;
  body: IS extends ZodType ? output<IS> : never;
  urlParams?: US extends ZodType ? output<US> : never;
}): () => Promise<output<OS>> {
  const inputSchema = apiRoute.inputSchema as IS;
  const outputSchema = apiRoute.outputSchema as OS;
  const urlSchema = apiRoute.urlSchema as US;
  return async () => {
    const parsedBody = inputSchema?.parse(body);
    const parsedUrlParams = urlSchema?.parse(urlParams);
    const data = await fetch(
      `${env.NEXT_PUBLIC_API_URL}${typeof apiRoute.route === "function" ? apiRoute.route(parsedUrlParams as US) : apiRoute.route}`,
      {
        method: apiRoute.method,
        body:
          apiRoute.method === "GET" ? undefined : JSON.stringify(parsedBody),
        headers: {
          ...(apiRoute.method === "GET"
            ? {}
            : { "Content-Type": "application/json" }),
        },
        credentials: "include", // Include cookies for authentication
      },
    );
    const json = await data.json();
    return outputSchema.parse(json);
  };
}

export const registerApiRoute = <
  I extends ZodType,
  O extends ZodType,
  U extends ZodType,
>(params: {
  route: `/${string}` | ((input: output<U>) => `/${string}`);
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "OPTIONS" | "HEAD";
  inputSchema?: I;
  urlSchema?: U;
  outputSchema: O;
}) => params;

export function smartFormatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }

  const totalSeconds = Math.round(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

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
  );
}
