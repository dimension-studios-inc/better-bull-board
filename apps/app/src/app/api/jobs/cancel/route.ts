import { createAuthenticatedApiRoute } from "~/lib/utils/server";
import { cancelJobHandler } from "./handler";
import { cancelJobApiRoute } from "./schemas";

export const POST = createAuthenticatedApiRoute({
  apiRoute: cancelJobApiRoute,
  async handler(input) {
    return cancelJobHandler(input);
  },
});
