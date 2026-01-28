import { jobRunsTable, jobSchedulersTable, queuesTable } from "@better-bull-board/db";
import { db } from "@better-bull-board/db/server";
import { sql } from "drizzle-orm";
import { createAuthenticatedApiRoute } from "~/lib/utils/server";
import { getQueuesStatsApiRoute } from "./schemas";

export const POST = createAuthenticatedApiRoute({
  apiRoute: getQueuesStatsApiRoute,
  async handler() {
    const result = await db.execute(
      sql`
      with last_run as (
        select distinct on (q.id)
          q.id as queue_id,
          jr.status
        from ${queuesTable} q
        join ${jobRunsTable} jr
          on jr.queue = q.name
        order by q.id, jr.created_at desc
      ),
      scheduler_queues as (
        select distinct queue_id
        from ${jobSchedulersTable}
      )
      select
        count(*) as total_queues,
        count(*) filter (where not q.is_paused) as active_queues,
        count(*) filter (where s.queue_id is not null) as queues_with_scheduler
      from ${queuesTable} q
      left join scheduler_queues s on s.queue_id = q.id;
  `,
    );
    const queues = (
      result.rows as {
        total_queues: string;
        active_queues: string;
        queues_with_scheduler: string;
      }[]
    )[0];

    if (!queues) {
      throw new Error("Failed to get queues stats");
    }

    return {
      total: Number(queues.total_queues),
      active: Number(queues.active_queues),
      withScheduler: Number(queues.queues_with_scheduler),
    };
  },
});
