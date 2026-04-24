import { logger } from "@rharkor/logger";
import { handleChannel } from "~/channels";
import { acquireLock, releaseLock, renewLock } from "~/lib/distributed-lock";
import { instanceId } from "~/lib/instance";
import { redis } from "~/lib/redis";

const LOG_PUBSUB_LOCK_KEY = "bbb:log-pubsub-ingest-lock";
const LOG_PUBSUB_LOCK_TTL_MS = 10_000;
const LOG_PUBSUB_RENEW_MS = 3_000;

export const startLogPubSubIngestion = () => {
  const loop = async () => {
    while (true) {
      const owner = `${instanceId}:${Date.now()}`;
      const acquired = await acquireLock({
        key: LOG_PUBSUB_LOCK_KEY,
        owner,
        ttlMs: LOG_PUBSUB_LOCK_TTL_MS,
      });

      if (!acquired) {
        await new Promise((resolve) => setTimeout(resolve, LOG_PUBSUB_RENEW_MS));
        continue;
      }

      const subscriber = redis.duplicate();
      let renewTimer: NodeJS.Timeout | undefined;

      try {
        await subscriber.connect().catch(() => {});
        await subscriber.psubscribe("bbb:worker:job:log", (error) => {
          if (error) throw error;
          logger.log("📥 Ingesting job logs from Redis pub/sub", { owner });
        });
        subscriber.on("pmessage", handleChannel);

        let stillLeader = true;
        renewTimer = setInterval(async () => {
          stillLeader = await renewLock({
            key: LOG_PUBSUB_LOCK_KEY,
            owner,
            ttlMs: LOG_PUBSUB_LOCK_TTL_MS,
          });
          if (!stillLeader) {
            subscriber.disconnect();
          }
        }, LOG_PUBSUB_RENEW_MS);

        while (stillLeader) {
          await new Promise((resolve) => setTimeout(resolve, LOG_PUBSUB_RENEW_MS));
        }
      } catch (error) {
        logger.error("Log pub/sub ingestion failed", { error });
      } finally {
        if (renewTimer) clearInterval(renewTimer);
        await releaseLock({ key: LOG_PUBSUB_LOCK_KEY, owner });
        subscriber.disconnect();
      }
    }
  };

  void loop();
};
