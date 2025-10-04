import type Redis from "ioredis";

async function acquireLock({
  lockKey,
  lockTtlMs,
  id,
  redis,
}: {
  lockKey: string;
  lockTtlMs: number;
  id: string;
  redis: Redis;
}) {
  // SET key value NX PX ttl
  return (await redis.set(lockKey, id, "PX", lockTtlMs, "NX")) === "OK";
}

async function renewLock({
  lockKey,
  lockTtlMs,
  id,
  redis,
}: {
  lockKey: string;
  lockTtlMs: number;
  id: string;
  redis: Redis;
}) {
  // Only renew if we still own it
  const owner = await redis.get(lockKey);
  if (owner === id) {
    await redis.pexpire(lockKey, lockTtlMs);
    return true;
  } else if (owner === null) {
    return acquireLock({ lockKey, lockTtlMs, id, redis });
  }
  return false;
}

export const onlyMaster = async ({
  id,
  lockKey,
  lockRenewMs,
  lockTtlMs,
  redis,
}: {
  id: string;
  lockKey: string;
  lockTtlMs: number;
  lockRenewMs: number;
  redis: Redis;
}) => {
  let isMaster = false;
  let renewInterval: NodeJS.Timeout | null = null;

  //* First we need to acquire the lock
  const lockAcquired = await acquireLock({ lockKey, lockTtlMs, id, redis });
  if (!lockAcquired) {
    isMaster = false;
  } else {
    isMaster = true;
  }

  //* Then we need to renew the lock
  renewInterval = setInterval(async () => {
    isMaster = await renewLock({ lockKey, lockTtlMs, id, redis });
  }, lockRenewMs);

  const cleanup = () => {
    if (renewInterval) {
      clearInterval(renewInterval);
      renewInterval = null;
    }
  };

  // Cleanup on process exit
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  return {
    isMaster: () => isMaster,
    cleanup
  };
};
