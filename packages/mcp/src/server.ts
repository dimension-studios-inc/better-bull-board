import { getSystemOverview, systemOverviewSchema } from "@better-bull-board/core";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const emptyInputSchema = z.object({}).strict();

const formatOverview = (overview: z.infer<typeof systemOverviewSchema>) =>
  [
    "# Better Bull Board System Overview",
    "",
    `- Active jobs: ${overview.activeJobs}`,
    `- Waiting jobs: ${overview.waitingJobs}`,
    `- Total queues: ${overview.totalQueues}`,
    `- Active queues: ${overview.activeQueues}`,
    `- Queues with schedulers: ${overview.queuesWithSchedulers}`,
  ].join("\n");

export const createBetterBullBoardMcpServer = () => {
  const server = new McpServer({
    name: "better-bull-board-mcp-server",
    version: "0.1.0",
  });

  server.registerTool(
    "bbb_get_system_overview",
    {
      title: "Get Better Bull Board System Overview",
      description:
        "Read a high-level Better Bull Board overview with active job count, waiting job count, total queues, active queues, and queues with schedulers. This tool is read-only and does not inspect job payloads or logs.",
      inputSchema: emptyInputSchema,
      outputSchema: systemOverviewSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      const overview = await getSystemOverview();

      return {
        content: [{ type: "text", text: formatOverview(overview) }],
        structuredContent: overview,
      };
    },
  );

  return server;
};
