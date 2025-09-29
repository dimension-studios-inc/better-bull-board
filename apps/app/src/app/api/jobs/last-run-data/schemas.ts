import z from "zod";
import { registerApiRoute } from "~/lib/utils/client";

export const getLastRunDataInput = z.object({
  queueName: z.string().min(1, "Queue name is required"),
});

export const getLastRunDataOutput = z.object({
  data: z.record(z.unknown()).nullable(),
  jobName: z.string().nullable(),
});

export const getLastRunDataApiRoute = registerApiRoute({
  route: "/api/jobs/last-run-data",
  method: "POST",
  inputSchema: getLastRunDataInput,
  outputSchema: getLastRunDataOutput,
});