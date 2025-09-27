import { createAuthenticatedApiRoute } from "~/lib/utils/server";
import { replayJobHandler } from "./handler";
import { replayJobApiRoute } from "./schemas";

export const POST = createAuthenticatedApiRoute({
  apiRoute: replayJobApiRoute,
  async handler(input) {
    return replayJobHandler(input);
  },
});
