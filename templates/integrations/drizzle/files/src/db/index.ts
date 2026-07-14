import { drizzle } from "drizzle-orm/bun-sql";
import { sql } from "./client.ts";
import * as schema from "./schema/index.ts";

/**
 * Query through Drizzle
 */
export const db = drizzle({ client: sql, schema });
