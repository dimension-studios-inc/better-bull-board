import { createAuthenticatedApiRoute } from "~/lib/utils/server";
import { createJobHandler } from "./handler";
import { createJobApiRoute } from "./schemas";

export const POST = createAuthenticatedApiRoute({
  apiRoute: createJobApiRoute,
  async handler(input) {
    return createJobHandler(input);
  },
});