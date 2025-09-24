import { Activity, AlertTriangle, CheckCircle, Server } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { getQueueInfo } from "~/lib/queue-info";

export async function QueueStats() {
  const queues = await getQueueInfo();

  const totalQueues = queues.length;
  const activeQueues = queues.filter((q) => !q.isPaused).length;
  const healthyQueues = queues.filter((q) => q.health === "healthy").length;
  const schedulerQueues = queues.filter((q) => q.hasScheduler).length;

  const stats = [
    {
      title: "Total Queues",
      value: totalQueues,
      icon: Server,
      description: "Configured queues",
      color: "text-blue-600",
    },
    {
      title: "Active Queues",
      value: activeQueues,
      icon: Activity,
      description: "Currently running",
      color: "text-green-600",
    },
    {
      title: "Healthy Queues",
      value: healthyQueues,
      icon: CheckCircle,
      description: "Operating normally",
      color: "text-green-600",
    },
    {
      title: "With Scheduler",
      value: schedulerQueues,
      icon: AlertTriangle,
      description: "Have scheduled jobs",
      color: "text-purple-600",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <Card key={stat.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {stat.title}
            </CardTitle>
            <stat.icon className={`h-4 w-4 ${stat.color}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stat.value}</div>
            <p className="text-xs text-muted-foreground">{stat.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
