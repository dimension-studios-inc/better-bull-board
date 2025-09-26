import clsx, { type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { output, ZodType } from "zod";
import { env } from "../env";

export type TApiRoute = {
  route: `/${string}`;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "OPTIONS" | "HEAD";
  inputSchema?: ZodType | undefined;
  outputSchema: ZodType;
};

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function apiFetch<
  R extends TApiRoute,
  IS extends R["inputSchema"],
  OS extends R["outputSchema"],
>({
  apiRoute,
  body,
}: {
  apiRoute: R;
  body: IS extends ZodType ? output<IS> : never;
}): () => Promise<output<OS>> {
  const inputSchema = apiRoute.inputSchema as IS;
  const outputSchema = apiRoute.outputSchema as OS;
  return async () => {
    const parsedBody = inputSchema?.parse(body);
    const data = await fetch(`${env.NEXT_PUBLIC_API_URL}${apiRoute.route}`, {
      method: apiRoute.method,
      body: JSON.stringify(parsedBody),
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include", // Include cookies for authentication
    });
    const json = await data.json();
    return outputSchema.parse(json);
  };
}

export const registerApiRoute = <I extends ZodType, O extends ZodType>(params: {
  route: `/${string}`;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "OPTIONS" | "HEAD";
  inputSchema?: I;
  outputSchema: O;
}) => params;
