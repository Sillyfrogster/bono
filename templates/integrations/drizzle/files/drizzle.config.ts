import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema",
  out: "./drizzle",
  dbCredentials: {
    // biome-ignore lint/style/noNonNullAssertion: fails loudly at CLI time if unset
    url: process.env.DATABASE_URL!,
  },
});
