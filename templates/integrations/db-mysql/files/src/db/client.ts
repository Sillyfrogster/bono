import { SQL } from "bun";
import { env } from "../config/env.ts";

export const sql = new SQL(env.DATABASE_URL);
