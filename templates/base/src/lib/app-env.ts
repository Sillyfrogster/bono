import type { RequestIdVariables } from "hono/request-id";

/** Hono env shared by the app and every route file. */
export type AppEnv = {
  Variables: RequestIdVariables;
};
