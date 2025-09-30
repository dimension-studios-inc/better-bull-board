import { logger } from "@rharkor/logger";
import { handleJobChannel } from "./job";
import { handleLogChannel } from "./log";
import { handleLivenessChannel } from "./liveness";

const CHANNELS = {
  "bbb:worker:liveness": handleLivenessChannel,
  "bbb:worker:job": handleJobChannel,
  "bbb:worker:job:log": handleLogChannel,
};

export const handleChannel = async (
  _subscribed: string,
  channel: string,
  message: string,
) => {
  const handler = CHANNELS[channel as keyof typeof CHANNELS];
  if (handler) {
    await handler(channel, message);
  } else {
    logger.warn("Received message from unknown channel", { channel, message });
  }
};
