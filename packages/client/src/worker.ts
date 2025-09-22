import {
  Worker as BullMQWorker,
  type Job,
  type Processor,
  type RedisConnection,
  type WorkerOptions,
} from "bullmq";
import { installConsoleRelay, withJobConsole } from "./lib/logger";

installConsoleRelay();

export class Worker<
  // biome-ignore lint/suspicious/noExplicitAny: extends of bullmq
  DataType = any,
  // biome-ignore lint/suspicious/noExplicitAny: extends of bullmq
  ResultType = any,
  NameType extends string = string,
> extends BullMQWorker<DataType, ResultType, NameType> {
  private publish: (channel: string, message: string) => void;

  constructor(
    name: string,
    processor: string | URL | null | Processor<DataType, ResultType, NameType>,
    opts: WorkerOptions & {
      /**
       * Function to publish a message to the channel
       * example: redis.publish
       */
      publish: (channel: string, message: string) => void;
    },
    Connection?: typeof RedisConnection,
  ) {
    super(name, processor, opts, Connection);
    this.publish = opts.publish;
    this.startLivenessProbe();
  }

  private startLivenessProbe() {
    setInterval(() => {
      const workerId = this.id;

      this.publish(
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
    //* Register the job
    this.publish(
      "bbb:worker:job",
      JSON.stringify({
        id: this.id,
        job,
      }),
    );
    //* Process
    const result = await withJobConsole(
      {
        id: this.id,
        publish: this.publish,
        autoEmitJobLogs: true,
        autoEmitBBBLogs: true,
        job,
      },
      () => super.processJob(job, token, fetchNextCallback, jobsInProgress),
    );
    //* Complete
    // When success: finishedOn is set and returnvalue is updated
    // When fail: failedReason, finishedOn and stacktrace are set
    this.publish(
      "bbb:worker:job",
      JSON.stringify({
        id: this.id,
        job,
      }),
    );
    return result;
  }
}
