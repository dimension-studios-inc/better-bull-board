import {
  Worker as BullMQWorker,
  type Job,
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
