import { drizzle } from "drizzle-orm/mysql2";
import { env } from "../config/env.ts";
import * as schema from "./schema/index.ts";

/** Query through Drizzle */
export const db = drizzle({
  connection: env.DATABASE_URL,
  schema,
  mode: "default",
});
