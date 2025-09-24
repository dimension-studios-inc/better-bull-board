import { type ClassValue, clsx } from "clsx";
import { type NextRequest, NextResponse } from "next/server";
import { twMerge } from "tailwind-merge";
import type { output, ZodType } from "zod";
import { env } from "./env";

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

export type TApiRoute = ReturnType<typeof registerApiRoute>;

export const createApiRoute = <IS extends ZodType, OS extends ZodType>({
  apiRoute,
  handler,
}: {
  apiRoute: {
    inputSchema?: IS;
    outputSchema: OS;
  };
  handler: (
    input: output<IS> | undefined,
    req: NextRequest,
  ) => Promise<output<OS>>;
}) => {
  const inputSchema = apiRoute.inputSchema as IS;
  const outputSchema = apiRoute.outputSchema as OS;
  return async (req: NextRequest) => {
    const json = req.method === "GET" ? undefined : await req.json();
    const parsed = await inputSchema?.parseAsync(json).catch((error) => {
      return NextResponse.json({ error: error.message }, { status: 400 });
    });
    if (parsed instanceof NextResponse) {
      return parsed;
    }
    const data = await handler(parsed as output<IS>, req);
    const validated = await outputSchema.parseAsync(data).catch((error) => {
      return NextResponse.json({ error: error.message }, { status: 500 });
    });
    if (validated instanceof NextResponse) {
      return validated;
    }
    return NextResponse.json(validated);
  };
};
