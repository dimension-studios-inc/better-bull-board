import { QueueStats } from "~/app/queues/_components/queue-stats";
import { QueuesTable } from "~/app/queues/_components/queues-table";

export default function QueuesPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Queues</h1>
        <p className="text-muted-foreground">
          Monitor and manage your BullMQ queues
        </p>
      </div>

      <QueueStats />
      <QueuesTable />
    </div>
  );
}
