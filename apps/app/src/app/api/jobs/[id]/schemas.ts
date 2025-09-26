import { jobRunDataSchema } from "@better-bull-board/clickhouse/schemas";
import z from "zod";
import { registerApiRoute } from "~/lib/utils/client";

export const getJobByIdInput = z.object({
  id: z.string(),
});

export const getJobByIdOutput = jobRunDataSchema;

export const getJobByIdApiRoute = registerApiRoute({
  route: "/api/jobs/[id]",
  method: "GET",
  inputSchema: getJobByIdInput,
  outputSchema: getJobByIdOutput,
});