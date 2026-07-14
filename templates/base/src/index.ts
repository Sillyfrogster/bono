import { app } from "./app.ts";
import { env } from "./config/env.ts";
import { logger } from "./lib/logger.ts";

const server = Bun.serve({
  port: env.PORT,
  fetch: app.fetch,
});

logger.info({ port: env.PORT, env: env.NODE_ENV }, "server listening");

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "shutting down");
  await server.stop();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
