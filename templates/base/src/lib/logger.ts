import pino from "pino";
import { env } from "../config/env.ts";

const usePretty = env.NODE_ENV === "development" && process.stdout.isTTY;

export const logger = pino(
  // Silent during `bun test` unless LOG_LEVEL is set explicitly.
  {
    level:
      env.NODE_ENV === "test" && !process.env.LOG_LEVEL
        ? "silent"
        : env.LOG_LEVEL,
  },
  usePretty
    ? (await import("pino-pretty")).default({ colorize: true })
    : undefined,
);
