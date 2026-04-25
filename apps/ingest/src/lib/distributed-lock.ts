import type Redis from "ioredis";
import { redis } from "~/lib/redis";

const RELEASE_LOCK_SCRIPT = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
end
return 0
`;

export const acquireLock = async ({
  key,
  owner,
  ttlMs,
  client = redis,
}: {
  key: string;
  owner: string;
  ttlMs: number;
  client?: Redis;
}) => {
  return (await client.set(key, owner, "PX", ttlMs, "NX")) === "OK";
};

export const releaseLock = async ({ key, owner, client = redis }: { key: string; owner: string; client?: Redis }) => {
  await client.eval(RELEASE_LOCK_SCRIPT, 1, key, owner);
};

export const renewLock = async ({
  key,
  owner,
  ttlMs,
  client = redis,
}: {
  key: string;
  owner: string;
  ttlMs: number;
  client?: Redis;
}) => {
  const currentOwner = await client.get(key);
  if (currentOwner !== owner) return false;
  await client.pexpire(key, ttlMs);
  return true;
};

export const withLock = async <T>({
  key,
  owner,
  ttlMs,
  run,
}: {
  key: string;
  owner: string;
  ttlMs: number;
  run: () => Promise<T>;
}) => {
  const acquired = await acquireLock({ key, owner, ttlMs });
  if (!acquired) return undefined;
  try {
    return await run();
  } finally {
    await releaseLock({ key, owner });
  }
};
