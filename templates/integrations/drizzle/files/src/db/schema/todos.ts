import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// Example table mirroring the todos feature. Replace with your own tables;
// each table gets its own file, exported from schema/index.ts.
export const todos = pgTable("todos", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  completed: boolean("completed").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
