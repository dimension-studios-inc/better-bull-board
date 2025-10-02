import { logger } from "@rharkor/logger";
import { type NextRequest, NextResponse } from "next/server";
import type { output, ZodType } from "zod";
import { getAuthenticatedUser } from "../auth/server";

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
            logger.error(
              `Error parsing JSON in ${req.url}: ${req.text()} ${e}`,
            );
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

export const createAuthenticatedApiRoute = <
  IS extends ZodType,
  OS extends ZodType,
>({
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
    // biome-ignore lint/suspicious/noExplicitAny: hard to type
    ctx: RouteContext<any>,
  ) => Promise<output<OS>>;
}) => {
  const inputSchema = apiRoute.inputSchema as IS;
  const outputSchema = apiRoute.outputSchema as OS;
  // biome-ignore lint/suspicious/noExplicitAny: hard to type
  return async (req: NextRequest, ctx: RouteContext<any>) => {
    // Check authentication first
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
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
      ctx,
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
