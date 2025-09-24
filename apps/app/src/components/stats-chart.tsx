import { JobTrendChart } from "~/components/job-trend-chart";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { getJobTrends } from "~/lib/job-stats";

export async function StatsCharts() {
  const trends = await getJobTrends();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Job Trends (24h)</CardTitle>
        </CardHeader>
        <CardContent>
          <JobTrendChart data={trends} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Queue Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {trends.queueActivity.map((queue) => (
              <div
                key={queue.name}
                className="flex items-center justify-between"
              >
                <div>
                  <p className="font-medium">{queue.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {queue.jobs} jobs processed
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">{queue.rate}/min</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
