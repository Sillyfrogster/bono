import { redis } from "./redis.ts";

export async function cacheGet<T>(key: string): Promise<T | null> {
  const raw = await redis.get(key);
  return raw === null ? null : (JSON.parse(raw) as T);
}

export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds?: number,
): Promise<void> {
  await redis.set(key, JSON.stringify(value));
  if (ttlSeconds !== undefined) {
    await redis.expire(key, ttlSeconds);
  }
}

export async function cacheDelete(key: string): Promise<void> {
  await redis.del(key);
}
