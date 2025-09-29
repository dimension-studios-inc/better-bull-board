import { createAuthenticatedApiRoute } from "~/lib/utils/server";
import { getLastRunDataHandler } from "./handler";
import { getLastRunDataApiRoute } from "./schemas";

export const POST = createAuthenticatedApiRoute({
  apiRoute: getLastRunDataApiRoute,
  async handler(input) {
    return getLastRunDataHandler(input);
  },
});