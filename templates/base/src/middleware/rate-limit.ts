import type { Context } from "hono";
import { getConnInfo } from "hono/bun";
import { createMiddleware } from "hono/factory";
import type { ErrorBody } from "../lib/errors.ts";

/**
 * Where hit counts live.
 */
export interface RateLimitStore {
  hit(
    key: string,
    windowMs: number,
  ): Promise<{ count: number; resetAt: number }>;
}

export class MemoryRateLimitStore implements RateLimitStore {
  private readonly windows = new Map<
    string,
    { count: number; resetAt: number }
  >();

  async hit(
    key: string,
    windowMs: number,
  ): Promise<{ count: number; resetAt: number }> {
    const now = Date.now();
    const existing = this.windows.get(key);
    if (existing && existing.resetAt > now) {
      const updated = { count: existing.count + 1, resetAt: existing.resetAt };
      this.windows.set(key, updated);
      return updated;
    }
    this.sweep(now);
    const fresh = { count: 1, resetAt: now + windowMs };
    this.windows.set(key, fresh);
    return fresh;
  }

  // Drops expired windows so the map doesn't grow forever.
  private sweep(now: number): void {
    for (const [key, window] of this.windows) {
      if (window.resetAt <= now) {
        this.windows.delete(key);
      }
    }
  }
}

const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX_REQUESTS = 100;

export interface RateLimitOptions {
  windowMs?: number;
  max?: number;
  store?: RateLimitStore;
}

export function rateLimit(options: RateLimitOptions = {}) {
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const max = options.max ?? DEFAULT_MAX_REQUESTS;
  const store = options.store ?? new MemoryRateLimitStore();

  return createMiddleware(async (c, next) => {
    const key = clientKey(c);
    const { count, resetAt } = await store.hit(key, windowMs);
    const secondsToReset = Math.max(
      0,
      Math.ceil((resetAt - Date.now()) / 1000),
    );

    c.header("RateLimit-Limit", String(max));
    c.header("RateLimit-Remaining", String(Math.max(0, max - count)));
    c.header("RateLimit-Reset", String(secondsToReset));

    if (count > max) {
      const body: ErrorBody = {
        error: {
          code: "RATE_LIMITED",
          message: "Too many requests, retry later",
        },
        requestId: c.get("requestId") ?? "",
      };
      return c.json(body, 429);
    }
    await next();
  });
}

// Proxy header first, then the socket address. "unknown" only happens in tests.
function clientKey(c: Context): string {
  const forwarded = c.req.header("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? "unknown";
  }
  try {
    return getConnInfo(c).remote.address ?? "unknown";
  } catch {
    return "unknown";
  }
}
