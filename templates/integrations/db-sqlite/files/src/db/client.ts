import { Database } from "bun:sqlite";
import { env } from "../config/env.ts";

export const sqlite = new Database(env.DATABASE_URL, { create: true });
