import { z } from "zod";

export const jobMutationInputSchema = z
  .object({
    jobId: z.string().min(1),
    queueName: z.string().min(1),
  })
  .strict();

export const queueMutationInputSchema = z
  .object({
    queueName: z.string().min(1),
  })
  .strict();

export const mutationResultSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
