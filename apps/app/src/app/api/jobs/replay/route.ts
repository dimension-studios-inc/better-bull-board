import { replayJob } from "~/lib/queue-mutations";
import { createAuthenticatedApiRoute } from "~/lib/utils/server";
import { replayJobApiRoute } from "./schemas";

export const POST = createAuthenticatedApiRoute({
  apiRoute: replayJobApiRoute,
  handler: replayJob,
});
