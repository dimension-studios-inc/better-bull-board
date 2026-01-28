import { QueueStats } from "~/app/queues/_components/queue-stats";
import { QueuesTable } from "~/app/queues/_components/queues-table";
import { PageContainer } from "~/components/page-container";
import { PageTitle } from "~/components/page-title";

export default function QueuesPage() {
  return (
    <PageContainer>
      <PageTitle title="Queues" description="Monitor and manage your BullMQ queues" />
      <QueueStats />
      <QueuesTable />
    </PageContainer>
  );
}
