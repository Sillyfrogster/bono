import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { applyIntegration, copyBase } from "../src/apply.ts";
import { integrationsFor, validateAnswers } from "../src/plan.ts";

describe("plan", () => {
  test("answers map to the right integrations", () => {
    expect(
      integrationsFor({ database: "none", docker: false, orm: "none" }),
    ).toEqual([]);
    expect(
      integrationsFor({ database: "postgres", docker: false, orm: "none" }),
    ).toEqual(["db-postgres"]);
    expect(
      integrationsFor({ database: "postgres", docker: true, orm: "drizzle" }),
    ).toEqual(["db-postgres", "compose-postgres", "drizzle"]);
  });

  test("bad flag combinations are refused, not silently mangled", () => {
    expect(
      validateAnswers({
        database: "mysql" as never,
        docker: false,
        orm: "none",
      }),
    ).toContain("Unknown database");
    expect(
      validateAnswers({ database: "none", docker: false, orm: "drizzle" }),
    ).toContain("makes no sense");
  });
});

describe("apply", () => {
  const templatesDir = resolve(import.meta.dir, "../../templates");
  let workDir: string;
  let dest: string;

  beforeEach(async () => {
    workDir = mkdtempSync(join(tmpdir(), "bono-test-"));
    dest = join(workDir, "app");
    await copyBase(templatesDir, dest, "app");
  });

  afterEach(() => {
    rmSync(workDir, { recursive: true, force: true });
  });

  test("copyBase personalizes and skips workspace files", async () => {
    const packageJson = await Bun.file(join(dest, "package.json")).json();
    const readme = await Bun.file(join(dest, "README.md")).text();

    expect(packageJson.name).toBe("app");
    expect(readme).toStartWith("# app\n");
    expect(existsSync(join(dest, ".gitignore"))).toBe(true);
    expect(existsSync(join(dest, "_gitignore"))).toBe(false);
    expect(existsSync(join(dest, "node_modules"))).toBe(false);
  });

  test("an integration lands completely: files, deps, env, insert, readme", async () => {
    await applyIntegration(templatesDir, dest, "db-postgres");
    await applyIntegration(templatesDir, dest, "drizzle");

    const packageJson = await Bun.file(join(dest, "package.json")).json();
    const envTs = await Bun.file(join(dest, "src/config/env.ts")).text();
    const env = await Bun.file(join(dest, ".env.example")).text();
    const readme = await Bun.file(join(dest, "README.md")).text();

    expect(existsSync(join(dest, "src/db/client.ts"))).toBe(true);
    expect(existsSync(join(dest, "drizzle.config.ts"))).toBe(true);
    expect(packageJson.dependencies["drizzle-orm"]).toBeDefined();
    expect(packageJson.scripts["db:generate"]).toBe("drizzle-kit generate");
    expect(envTs).toContain("DATABASE_URL: z.url(),");
    expect(env).toContain("DATABASE_URL=");
    expect(readme).toContain("## Database");
  });

  test("applying the same integration twice changes nothing", async () => {
    await applyIntegration(templatesDir, dest, "db-postgres");
    const envTs = await Bun.file(join(dest, "src/config/env.ts")).text();
    const readme = await Bun.file(join(dest, "README.md")).text();

    await applyIntegration(templatesDir, dest, "db-postgres");

    expect(await Bun.file(join(dest, "src/config/env.ts")).text()).toBe(envTs);
    expect(await Bun.file(join(dest, "README.md")).text()).toBe(readme);
  });
});
