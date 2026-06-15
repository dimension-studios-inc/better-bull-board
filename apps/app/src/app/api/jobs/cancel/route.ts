import { cancelJob } from "~/lib/queue-mutations";
import { createAuthenticatedApiRoute } from "~/lib/utils/server";
import { cancelJobApiRoute } from "./schemas";

export const POST = createAuthenticatedApiRoute({
  apiRoute: cancelJobApiRoute,
  handler: cancelJob,
});
