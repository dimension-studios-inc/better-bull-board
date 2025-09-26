import { logger } from "@rharkor/logger";
import { type ClassValue, clsx } from "clsx";
import { type NextRequest, NextResponse } from "next/server";
import { twMerge } from "tailwind-merge";
import type { output, ZodType } from "zod";
import { env } from "./env";
import { getAuthenticatedUser } from "./auth";

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
      credentials: 'include', // Include cookies for authentication
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
    input: IS extends ZodType ? output<IS> : undefined,
    req: NextRequest,
  ) => Promise<output<OS>>;
}) => {
  const inputSchema = apiRoute.inputSchema as IS;
  const outputSchema = apiRoute.outputSchema as OS;
  return async (req: NextRequest) => {
    const json =
      req.method === "GET" || !apiRoute.inputSchema
        ? undefined
        : await req.json().catch((e) => {
            logger.error(`Error parsing JSON in ${req.url}: ${e}`);
            throw e;
          });
    const parsed = await inputSchema?.parseAsync(json).catch((error) => {
      return NextResponse.json({ error: error.message }, { status: 400 });
    });
    if (parsed instanceof NextResponse) {
      return parsed;
    }
    const data = await handler(
      parsed as IS extends ZodType ? output<IS> : undefined,
      req,
    );
    const validated = await outputSchema.parseAsync(data).catch((error) => {
      logger.error(error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    });
    if (validated instanceof NextResponse) {
      return validated;
    }
    return NextResponse.json(validated);
  };
};

export const createAuthenticatedApiRoute = <IS extends ZodType, OS extends ZodType>({
  apiRoute,
  handler,
}: {
  apiRoute: {
    inputSchema?: IS;
    outputSchema: OS;
  };
  handler: (
    input: IS extends ZodType ? output<IS> : undefined,
    req: NextRequest,
  ) => Promise<output<OS>>;
}) => {
  const inputSchema = apiRoute.inputSchema as IS;
  const outputSchema = apiRoute.outputSchema as OS;
  return async (req: NextRequest) => {
    // Check authentication first
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const json =
      req.method === "GET" || !apiRoute.inputSchema
        ? undefined
        : await req.json().catch((e) => {
            logger.error(`Error parsing JSON in ${req.url}: ${e}`);
            throw e;
          });
    const parsed = await inputSchema?.parseAsync(json).catch((error) => {
      return NextResponse.json({ error: error.message }, { status: 400 });
    });
    if (parsed instanceof NextResponse) {
      return parsed;
    }
    const data = await handler(
      parsed as IS extends ZodType ? output<IS> : undefined,
      req,
    );
    const validated = await outputSchema.parseAsync(data).catch((error) => {
      logger.error(error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    });
    if (validated instanceof NextResponse) {
      return validated;
    }
    return NextResponse.json(validated);
  };
};
