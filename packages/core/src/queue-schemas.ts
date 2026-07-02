import { z } from "zod";

export const listQueuesBaseInputSchema = z.object({
  cursor: z
    .object({
      waitingJobs: z.number(),
      activeJobs: z.number().optional(),
      pressure: z.number().optional(),
      name: z.string(),
    })
    .nullish(),
  cursorDirection: z.enum(["next", "prev"]).optional(),
  search: z.string().optional(),
  sortBy: z.enum(["waitingJobs", "activeJobs", "pressure"]).optional().default("waitingJobs"),
  sortDirection: z.enum(["asc", "desc"]).optional().default("desc"),
  pressureDateFrom: z.date().optional(),
  pressureDateTo: z.date().optional(),
  limit: z.number().min(1).max(100).optional(),
});

export const listQueuesInputSchema = listQueuesBaseInputSchema.superRefine((input, ctx) => {
  if (input.sortBy === "pressure") {
    if (!input.pressureDateFrom) {
      ctx.addIssue({
        code: "custom",
        message: "Pressure date from is required when sorting by pressure",
        path: ["pressureDateFrom"],
      });
    }

    if (!input.pressureDateTo) {
      ctx.addIssue({
        code: "custom",
        message: "Pressure date to is required when sorting by pressure",
        path: ["pressureDateTo"],
      });
    }

    if (input.pressureDateFrom && input.pressureDateTo && input.pressureDateFrom >= input.pressureDateTo) {
      ctx.addIssue({
        code: "custom",
        message: "Pressure date from must be before pressure date to",
        path: ["pressureDateFrom"],
      });
    }

    if (input.cursor && input.cursor.pressure === undefined) {
      ctx.addIssue({
        code: "custom",
        message: "Pressure cursor is required when sorting by pressure",
        path: ["cursor", "pressure"],
      });
    }
  }
});

export const listQueuesOutputSchema = z.object({
  queues: z.array(
    z.object({
      name: z.string(),
      isPaused: z.boolean(),
      patterns: z.array(z.string()),
      everys: z.array(z.number()),
      waitingJobs: z.number(),
      activeJobs: z.number(),
      pressure: z.number(),
    }),
  ),
  nextCursor: z
    .object({
      waitingJobs: z.number(),
      activeJobs: z.number(),
      pressure: z.number(),
      name: z.string(),
    })
    .nullable(),
  prevCursor: z
    .object({
      waitingJobs: z.number(),
      activeJobs: z.number(),
      pressure: z.number(),
      name: z.string(),
    })
    .nullable(),
  total: z.number(),
});
