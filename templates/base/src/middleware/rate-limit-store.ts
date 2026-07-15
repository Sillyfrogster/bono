import { MemoryRateLimitStore, type RateLimitStore } from "./rate-limit.ts";

// Integrations replace this to swap stores
export function createRateLimitStore(): RateLimitStore {
  return new MemoryRateLimitStore();
}
