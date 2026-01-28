"use client";

import { useState } from "react";
import { type TimePeriod, TimePeriodSelector } from "~/components/time-period-selector";
import { EnhancedStatsCards } from "./enhanced-stats-cards";
import { QueueCountChart } from "./queue-count-chart";
import { QueueDurationChart } from "./queue-duration-chart";
import { QueuePerformanceTable } from "./queue-performance-table";
import { RunGraphChart } from "./run-graph-chart";

export function EnhancedDashboard() {
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("1");
  const days = parseInt(timePeriod, 10);

  return (
    <div className="space-y-6">
      {/* Time Period Selector */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold">Dashboard Analytics</h2>
          <p className="text-sm text-muted-foreground">Monitor your BullMQ job performance and queue analytics</p>
        </div>
        <TimePeriodSelector value={timePeriod} onChange={setTimePeriod} />
      </div>

      {/* Enhanced Stats Cards */}
      <EnhancedStatsCards days={days} />

      {/* Queue Performance Table */}
      <QueuePerformanceTable days={days} />

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <QueueDurationChart days={days} />
        <QueueCountChart days={days} />
      </div>

      {/* Run Graph */}
      <RunGraphChart days={days} />
    </div>
  );
}
