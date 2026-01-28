import { logger } from "@rharkor/logger";
import { Worker as BullMQWorker, type Job, Queue, QueueEvents, type RedisConnection, type WorkerOptions } from "bullmq";
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
  private getJobTags?: (job: Job<DataType, ResultType, NameType>) => (string | undefined)[];

  hasWaitingJobsEventsInitialized = false;

  constructor(
    name: string,
    processor: string | URL | null, // Do not allow processor, we need to use sandboxed processor in order to be able to cancel the job (see: https://docs.bullmq.io/guide/workers/sandboxed-processors)
    opts: WorkerOptions & {
      ioredis: Redis;
      /**
       * Should return the tags of the job
       */
      getJobTags?: (job: Job<DataType, ResultType, NameType>) => (string | undefined)[];
    },
    Connection?: typeof RedisConnection,
  ) {
    super(name, processor, opts, Connection);
    this.ioredis = opts.ioredis;
    this.getJobTags = opts.getJobTags;
    // this.startLivenessProbe();

    this.waitingJobsEvent();
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

  private async waitingJobsEvent() {
    const queueName = this.name;
    const queue = new Queue(queueName, { connection: this.ioredis });

    // Master election for this queue
    const isMaster = await onlyMaster({
      id: this.id,
      lockKey: `bbb:waiting-jobs-lock:${queueName}`,
      lockTtlMs: 5000,
      lockRenewMs: 3000,
      redis: this.ioredis,
    });

    let listener: QueueEvents | null = null;
    let subscribed = false;
    let messageHandler: ((args: { jobId: string; prev?: string }) => void) | null;
    const channel = `bbb:queue:${queueName}:job:waiting`;

    const ensureSubscription = async () => {
      if (isMaster() && !subscribed) {
        subscribed = true;
        // ✅ we became master → subscribe
        listener ??= new QueueEvents(queueName, { connection: this.ioredis });

        const onMessage = async (args: { jobId: string; prev?: string }) => {
          const job = await queue.getJob(args.jobId);
          if (!job) return;
          const tags = this.getJobTags?.(job as Job<DataType, ResultType, NameType>).filter(Boolean);
          const isWaiting = await job.isWaiting();
          if (!isWaiting) return;
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
        };

        messageHandler = onMessage;
        await listener.waitUntilReady();
        listener.on("waiting", messageHandler);
        logger.log(`[${this.id}] subscribed to ${channel}`);
      } else if (!isMaster() && subscribed && listener) {
        // ❌ we lost master → unsubscribe
        if (messageHandler) listener.off("waiting", messageHandler);
        await listener.disconnect();
        listener = null;
        messageHandler = null;
        subscribed = false;
        logger.log(`[${this.id}] unsubscribed from ${channel}`);
      }
      this.hasWaitingJobsEventsInitialized = true;
    };

    // run every 2s (tweak to your needs)
    setInterval(ensureSubscription, 2000);
    await ensureSubscription();
  }

  override async waitUntilReady() {
    const redis = await super.waitUntilReady();
    let attempts = 0;
    while (!this.hasWaitingJobsEventsInitialized && attempts < 20) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      attempts++;
    }
    if (!this.hasWaitingJobsEventsInitialized) {
      throw new Error("Waiting jobs events failed to initialize after 20 seconds");
    }
    return redis;
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
    const result = await super.processJob(job, token, fetchNextCallback, jobsInProgress);

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
