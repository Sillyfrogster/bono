import { Hono } from "hono";
import { cors } from "hono/cors";
import { requestId } from "hono/request-id";
import { todosRoutes } from "./features/todos/todos.routes.ts";
import type { AppEnv } from "./lib/app-env.ts";
import { AppError, type ErrorBody } from "./lib/errors.ts";
import { logger } from "./lib/logger.ts";
import { rateLimit } from "./middleware/rate-limit.ts";
import { createRateLimitStore } from "./middleware/rate-limit-store.ts";
import { requestLogger } from "./middleware/request-logger.ts";

export const app = new Hono<AppEnv>();

app.use(requestId());
app.use(requestLogger());
app.use(cors());
app.use(rateLimit({ store: createRateLimitStore() }));
// bono:middleware

app.get("/health", (c) => c.json({ status: "ok" }));
app.route("/todos", todosRoutes);
// bono:routes

app.notFound((c) => {
  const body: ErrorBody = {
    error: {
      code: "NOT_FOUND",
      message: `No route for ${c.req.method} ${c.req.path}`,
    },
    requestId: c.get("requestId") ?? "",
  };
  return c.json(body, 404);
});

app.onError((err, c) => {
  const requestId = c.get("requestId") ?? "";

  if (err instanceof AppError) {
    const body: ErrorBody = {
      error: { code: err.code, message: err.message },
      requestId,
    };
    return c.json(body, err.status);
  }

  // Unexpected errors: log everything, leak nothing.
  logger.error({ requestId, err }, "unhandled error");
  const body: ErrorBody = {
    error: { code: "INTERNAL_ERROR", message: "Something went wrong" },
    requestId,
  };
  return c.json(body, 500);
});
