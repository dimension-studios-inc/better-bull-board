import { StatsCards } from "~/app/_components/stats-card";
import { PageContainer } from "~/components/page-container";
import { PageTitle } from "~/components/page-title";

export default function Home() {
  return (
    <PageContainer>
      <PageTitle
        title="Dashboard"
        description="Monitor your BullMQ job statistics"
      />
      <StatsCards />
    </PageContainer>
  );
}
