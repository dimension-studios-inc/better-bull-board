import { QueueStats } from "~/app/queues/_components/queue-stats"
import { QueuesTable } from "~/app/queues/_components/queues-table"
import { PageContainer } from "~/components/page-container"

export default function QueuesPage() {
  return (
    <PageContainer>
      <QueueStats />
      <QueuesTable />
    </PageContainer>
  )
}
