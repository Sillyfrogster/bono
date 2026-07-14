import { zValidator } from "@hono/zod-validator";
import type { ValidationTargets } from "hono";
import type { ZodType } from "zod";
import type { ErrorBody } from "./errors.ts";

/**
 * zValidator wrapped so validation failures use the app's error shape
 * instead of the library default. Use it exactly like zValidator:
 *
 *   app.post("/", validate("json", createTodoSchema), handler)
 */
export function validate<Schema extends ZodType, Target extends keyof ValidationTargets>(target: Target, schema: Schema) {
  return zValidator(target, schema, (result, c) => {
    if (!result.success) {
      const body: ErrorBody = {
        error: {
          code: "VALIDATION_ERROR",
          message: `Invalid ${target}`,
          details: result.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
        requestId: c.get("requestId") ?? "",
      };
      return c.json(body, 400);
    }
  });
}
