import { StatsCards } from "~/app/_components/stats-card";

export default function Home() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">
          Monitor your BullMQ job statistics
        </p>
      </div>

      <StatsCards />
    </div>
  );
}
