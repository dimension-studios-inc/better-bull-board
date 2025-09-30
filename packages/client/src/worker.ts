import { logger } from "@rharkor/logger";
import {
  Worker as BullMQWorker,
  type Job,
  Queue,
  type RedisConnection,
  type WorkerOptions,
} from "bullmq";
import type Redis from "ioredis";
import { onlyMaster } from "./lib/master";

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
    // this.startLivenessProbe();

    this.waitingJobsEvent(name);
  }

  // private startLivenessProbe() {
  //   setInterval(() => {
  //     const workerId = this.id;

  //     this.ioredis.publish(
  //       "bbb:worker:liveness",
  //       JSON.stringify({
  //         id: workerId,
  //       }),
  //     );
  //   }, 5000);
  // }

  private async waitingJobsEvent(queueName: string) {
    const queue = new Queue(queueName, { connection: this.ioredis });

    // Master election for this queue
    const isMaster = await onlyMaster({
      id: this.id,
      lockKey: `bbb:waiting-jobs-lock:${queueName}`,
      lockTtlMs: 5000,
      lockRenewMs: 3000,
      redis: this.ioredis,
    });

    let listener: Redis | null = null;
    let subscribed = false;
    const channel = `bbb:queue:${queueName}:job:waiting`;

    const ensureSubscription = async () => {
      if (isMaster() && !subscribed) {
        // ✅ we became master → subscribe
        listener ??= this.ioredis.duplicate();
        await listener.connect().catch(() => {});

        listener.subscribe(channel, (err) => {
          if (err) {
            logger.error(`Error subscribing: ${err}`);
            return;
          }
          logger.log(`[${this.id}] subscribed to ${channel}`);
          subscribed = true;
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

          await this.ioredis.publish(
            "bbb:worker:job",
            JSON.stringify({
              id: this.id,
              job,
              tags,
              queueName,
              isWaiting: true,
            }),
          );

          await this.ioredis.publish(
            `bbb:queue:${queueName}:job:waiting:${jobId}`,
            JSON.stringify({ id: this.id }),
          );
        });
      } else if (!isMaster() && subscribed && listener) {
        // ❌ we lost master → unsubscribe
        await listener.unsubscribe(channel).catch(() => {});
        subscribed = false;
        logger.log(`[${this.id}] unsubscribed from ${channel}`);
      }
    };

    // run every 2s (tweak to your needs)
    setInterval(ensureSubscription, 2000);
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
