import { logger } from "@rharkor/logger";

const CHANNELS = {
  "bbb:worker:liveness": (channel: string, message: string) => {},
  "bbb:worker:job": (channel: string, message: string) => {},
  "bbb:worker:job:log": (channel: string, message: string) => {},
};

export const handleChannel = (
  _subscribed: string,
  channel: string,
  message: string,
) => {
  const handler = CHANNELS[channel as keyof typeof CHANNELS];
  if (handler) {
    handler(channel, message);
  } else {
    logger.warn("Received message from unknown channel", { channel, message });
  }
};
