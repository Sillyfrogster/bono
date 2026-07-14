import { createMiddleware } from "hono/factory";
import { logger } from "../lib/logger.ts";

/** One structured log line per request: method, path, status, duration, request ID. */
export function requestLogger() {
  return createMiddleware(async (c, next) => {
    const startedAt = performance.now();
    await next();
    const durationMs = Math.round(performance.now() - startedAt);
    logger.info(
      {
        requestId: c.get("requestId"),
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
        durationMs,
      },
      "request",
    );
  });
}
