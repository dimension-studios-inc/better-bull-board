import { logger } from "@rharkor/logger";
import { Queue as BullMQQueue, type QueueOptions } from "bullmq";

const registerQueue = async (name: string, options: QueueOptions) => {
  logger.info("Registering queue", { name, options });
};

export class Queue extends BullMQQueue {
  constructor(name: string, options: QueueOptions) {
    super(name, options);
    registerQueue(name, options);
  }
}
