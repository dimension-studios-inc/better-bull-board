import { logger } from "@rharkor/logger";
import { handleJobChannel } from "./job";

const CHANNELS = {
  "bbb:worker:liveness": async (_channel: string, _message: string) => {
    // Do nothing for now
  },
  "bbb:worker:job": handleJobChannel,
};

export const handleChannel = async (_subscribed: string, channel: string, message: string) => {
  const handler = CHANNELS[channel as keyof typeof CHANNELS];
  if (handler) {
    await handler(channel, message);
  } else {
    logger.warn("Received message from unknown channel", { channel, message });
  }
};
