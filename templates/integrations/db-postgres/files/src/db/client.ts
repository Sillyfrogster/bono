import { SQL } from "bun";
import { env } from "../config/env.ts";

/**
 * Bun's native Postgres client.
 */
export const sql = new SQL(env.DATABASE_URL);
