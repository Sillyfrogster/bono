import { drizzle } from "drizzle-orm/bun-sqlite";
import { sqlite } from "./client.ts";
import * as schema from "./schema/index.ts";

/** Query through Drizzle */
export const db = drizzle({ client: sqlite, schema });
