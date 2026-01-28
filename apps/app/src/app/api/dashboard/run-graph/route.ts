import { jobRunsTable } from "@better-bull-board/db";
import { db } from "@better-bull-board/db/server";
import { addDays, addHours, startOfDay, startOfHour } from "date-fns";
import { and, count, gte, lte, type SQL, sql } from "drizzle-orm";
import { createAuthenticatedApiRoute } from "~/lib/utils/server";
import { getRunGraphApiRoute } from "./schemas";

export const POST = createAuthenticatedApiRoute({
  apiRoute: getRunGraphApiRoute,
  async handler(input) {
    const days = input?.days || 1;
    const dateFrom = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const dateTo = new Date();

    try {
      let interval: SQL<string>;
      let stepKind: string;

      if (days <= 1 || days <= 7) {
        interval = sql<string>`date_trunc('hour', ${jobRunsTable.createdAt})`;
        stepKind = "hour";
      } else {
        interval = sql<string>`date_trunc('day', ${jobRunsTable.createdAt})`;
        stepKind = "day";
      }

      const result = await db
        .select({
          timestamp: interval,
          runCount: count(),
        })
        .from(jobRunsTable)
        .where(and(gte(jobRunsTable.createdAt, dateFrom), lte(jobRunsTable.createdAt, dateTo)))
        .groupBy(interval)
        .orderBy(interval);

      const chartData = result.map((item) => ({
        timestamp: new Date(item.timestamp).toISOString().slice(0, 19).replace("T", " "),
        runCount: Number(item.runCount),
      }));

      // Fill in missing data points
      const filled = [];
      const map = new Map(chartData.map((d) => [d.timestamp, d]));

      for (let d = new Date(dateFrom); d <= dateTo; d = stepKind === "hour" ? addHours(d, 1) : addDays(d, 1)) {
        const ts =
          stepKind === "hour"
            ? startOfHour(d).toISOString().slice(0, 19).replace("T", " ")
            : startOfDay(d).toISOString().slice(0, 19).replace("T", " ");

        if (map.has(ts)) {
          filled.push(map.get(ts));
        } else {
          filled.push({ timestamp: ts, runCount: 0 });
        }
      }

      return filled.filter((d) => d !== undefined);
    } catch (error) {
      console.error("Error fetching run graph data:", error);
      throw new Error("Failed to fetch run graph data");
    }
  },
});
