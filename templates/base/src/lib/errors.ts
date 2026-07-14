import type { ContentfulStatusCode } from "hono/utils/http-status";

/**
 * Throw this anywhere in a handler or service to produce a clean error
 * response. Anything else that throws becomes a 500 with no leaked details.
 */
export class AppError extends Error {
  readonly status: ContentfulStatusCode;
  readonly code: string;

  constructor(status: ContentfulStatusCode, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** The one error response shape used everywhere. */
export interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  requestId: string;
}
