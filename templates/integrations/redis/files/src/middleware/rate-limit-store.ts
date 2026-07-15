import { redis } from "../lib/redis.ts";
import type { RateLimitStore } from "./rate-limit.ts";

export function createRateLimitStore(): RateLimitStore {
  return new RedisRateLimitStore();
}

class RedisRateLimitStore implements RateLimitStore {
  async hit(
    key: string,
    windowMs: number,
  ): Promise<{ count: number; resetAt: number }> {
    const redisKey = `ratelimit:${key}`;
    const windowSeconds = Math.ceil(windowMs / 1000);
    const count = await redis.incr(redisKey);
    if (count === 1) {
      await redis.expire(redisKey, windowSeconds);
      return { count, resetAt: Date.now() + windowSeconds * 1000 };
    }
    const ttl = await redis.ttl(redisKey);
    return { count, resetAt: Date.now() + Math.max(0, ttl) * 1000 };
  }
}
