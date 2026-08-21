import z from "zod"
import { registerApiRoute } from "~/lib/utils/client"

const getTagsInput = z.object({
  search: z.string().optional(),
})

const getTagsOutput = z.object({
  tags: z.array(z.string()),
})

export const getTagsApiRoute = registerApiRoute({
  route: "/api/tags",
  method: "POST",
  inputSchema: getTagsInput,
  outputSchema: getTagsOutput,
})
