import z from "zod";
import { registerApiRoute } from "~/lib/utils/client";

export const createJobInput = z.object({
  queueName: z.string().min(1, "Queue name is required"),
  jobName: z.string().min(1, "Job name is required"),
  data: z.record(z.unknown()).optional().default({}),
  options: z.object({
    delay: z.number().optional(),
    priority: z.number().optional(),
    attempts: z.number().min(1).optional().default(1),
  }).optional().default({}),
});

export const createJobOutput = z.object({
  success: z.boolean(),
  jobId: z.string(),
  message: z.string(),
});

export const createJobApiRoute = registerApiRoute({
  route: "/api/jobs/create",
  method: "POST",
  inputSchema: createJobInput,
  outputSchema: createJobOutput,
});