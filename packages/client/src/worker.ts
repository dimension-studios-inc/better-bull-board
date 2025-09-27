import { logger } from "@rharkor/logger";
import {
  Worker as BullMQWorker,
  type Job,
  Queue,
  type RedisConnection,
  type WorkerOptions,
} from "bullmq";
import type Redis from "ioredis";

export class Worker<
  // biome-ignore lint/suspicious/noExplicitAny: extends of bullmq
  DataType = any,
  // biome-ignore lint/suspicious/noExplicitAny: extends of bullmq
  ResultType = any,
  NameType extends string = string,
> extends BullMQWorker<DataType, ResultType, NameType> {
  private ioredis: Redis;
  private getJobTags?: (
    job: Job<DataType, ResultType, NameType>,
  ) => (string | undefined)[];

  constructor(
    name: string,
    processor: string | URL | null, // Do not allow processor, we need to use sandboxed processor in order to be able to cancel the job (see: https://docs.bullmq.io/guide/workers/sandboxed-processors)
    opts: WorkerOptions & {
      ioredis: Redis;
      /**
       * Should return the tags of the job
       */
      getJobTags?: (
        job: Job<DataType, ResultType, NameType>,
      ) => (string | undefined)[];
    },
    Connection?: typeof RedisConnection,
  ) {
    super(name, processor, opts, Connection);
    this.ioredis = opts.ioredis;
    this.getJobTags = opts.getJobTags;
    this.startLivenessProbe();
    this.waitingJobsEvent(name);
  }

  private startLivenessProbe() {
    setInterval(() => {
      const workerId = this.id;

      this.ioredis.publish(
        "bbb:worker:liveness",
        JSON.stringify({
          id: workerId,
        }),
      );
    }, 5000);
  }

  private async waitingJobsEvent(queueName: string) {
    const listener = this.ioredis.duplicate();
    await listener.connect().catch(() => {});
    const queue = new Queue(queueName, { connection: this.ioredis });
    listener.subscribe(`bbb:queue:${queueName}:job:waiting`, (err) => {
      if (err) {
        logger.error(`Error subscribing to waiting jobs: ${err}`);
        return;
      }
    });
    listener.on("message", async (_channel, message) => {
      const { jobId } = JSON.parse(message) as { jobId: string };
      const job = await queue.getJob(jobId);
      if (!job) {
        logger.error(`Job not found: ${jobId}`);
        return;
      }
      const tags = this.getJobTags?.(
        job as Job<DataType, ResultType, NameType>,
      ).filter(Boolean);
      this.ioredis.publish(
        "bbb:worker:job",
        JSON.stringify({
          id: this.id,
          job,
          tags,
          queueName,
          isWaiting: true,
        }),
      );
      // Answer the ingester
      this.ioredis.publish(
        `bbb:queue:${queueName}:job:waiting:${jobId}`,
        JSON.stringify({
          id: this.id,
        }),
      );
    });
  }

  override async processJob(
    job: Job<DataType, ResultType, NameType>,
    token: string,
    fetchNextCallback: () => boolean,
    jobsInProgress: Set<{
      job: Job;
      ts: number;
    }>,
    // biome-ignore lint/suspicious/noConfusingVoidType: override
  ): Promise<void | Job<DataType, ResultType, NameType>> {
    if (!job.id) {
      throw new Error("Job ID is required");
    }
    const tags = this.getJobTags?.(job).filter(Boolean);
    const queueName = job.queueName;
    //* Register the job
    this.ioredis.publish(
      "bbb:worker:job",
      JSON.stringify({
        id: this.id,
        job,
        tags,
        queueName,
      }),
    );
    //* Process
    const result = await super.processJob(
      job,
      token,
      fetchNextCallback,
      jobsInProgress,
    );

    //* Complete
    // When success: finishedOn is set and returnvalue is updated
    // When fail: failedReason, finishedOn and stacktrace are set
    this.ioredis.publish(
      "bbb:worker:job",
      JSON.stringify({
        id: this.id,
        job,
        tags,
        queueName,
      }),
    );
    return result;
  }
}
