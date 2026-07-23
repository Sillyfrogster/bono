import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { applyIntegration, copyBase, writeCompose } from "../src/apply.ts";
import { integrationsFor, validateAnswers } from "../src/plan.ts";

const cli = resolve(import.meta.dir, "../index.ts");

describe("cli", () => {
  let workDir: string;

  beforeEach(() => {
    workDir = mkdtempSync(join(tmpdir(), "bono-cli-test-"));
  });

  afterEach(() => {
    rmSync(workDir, { recursive: true, force: true });
  });

  test("rejects conflicting options before writing files", () => {
    const cases = [
      {
        name: "orm-without-db",
        args: ["--database", "none", "--orm", "drizzle"],
        message: "An ORM without a database makes no sense",
      },
      {
        name: "docker-without-service",
        args: ["--database", "none", "--cache", "none", "--docker"],
        message: "docker-compose needs a local service",
      },
      {
        name: "both-docker-options",
        args: ["--database", "postgres", "--docker", "--no-docker"],
        message: "Choose either --docker or --no-docker",
      },
      {
        name: "base-with-database",
        args: ["--base", "--database", "postgres"],
        message: "--base cannot be combined with integration flags",
      },
    ];

    for (const testCase of cases) {
      const result = runCli([
        "new",
        testCase.name,
        ...testCase.args,
        "--no-git",
        "--no-install",
      ]);

      expect(result.exitCode).toBe(1);
      expect(`${result.stdout}${result.stderr}`).toContain(testCase.message);
      expect(existsSync(join(workDir, testCase.name))).toBe(false);
    }
  });

  test("rejects extra arguments", () => {
    const result = runCli([
      "new",
      "app",
      "extra",
      "--base",
      "--no-git",
      "--no-install",
    ]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Unexpected argument "extra".');
    expect(existsSync(join(workDir, "app"))).toBe(false);
  });

  test("rejects unknown options without a stack trace", () => {
    const result = runCli(["new", "app", "--unknown"]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Unknown option '--unknown'");
    expect(result.stderr).not.toContain("at parseArgs");
  });

  function runCli(args: string[]) {
    const result = Bun.spawnSync(["bun", cli, ...args], {
      cwd: workDir,
      stdout: "pipe",
      stderr: "pipe",
    });
    return {
      exitCode: result.exitCode,
      stdout: result.stdout.toString(),
      stderr: result.stderr.toString(),
    };
  }
});

describe("plan", () => {
  test("answers map to the right integrations", () => {
    expect(
      integrationsFor({
        database: "none",
        orm: "none",
        cache: "none",
        docker: false,
      }),
    ).toEqual([]);
    expect(
      integrationsFor({
        database: "postgres",
        orm: "none",
        cache: "none",
        docker: false,
      }),
    ).toEqual(["db-postgres"]);
    expect(
      integrationsFor({
        database: "postgres",
        orm: "drizzle",
        cache: "redis",
        docker: true,
      }),
    ).toEqual(["db-postgres", "drizzle-postgres", "redis"]);
    expect(
      integrationsFor({
        database: "sqlite",
        orm: "drizzle",
        cache: "none",
        docker: false,
      }),
    ).toEqual(["db-sqlite", "drizzle-sqlite"]);
    expect(
      integrationsFor({
        database: "none",
        orm: "none",
        cache: "redis",
        docker: false,
      }),
    ).toEqual(["redis"]);
  });

  test("bad flag combinations are refused, not silently mangled", () => {
    expect(
      validateAnswers({
        database: "mysql" as never,
        orm: "none",
        cache: "none",
        docker: false,
      }),
    ).toContain("Unknown database");
    expect(
      validateAnswers({
        database: "none",
        orm: "drizzle",
        cache: "none",
        docker: false,
      }),
    ).toContain("makes no sense");
    expect(
      validateAnswers({
        database: "none",
        orm: "none",
        cache: "none",
        docker: true,
      }),
    ).toContain("local service");
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
    await applyIntegration(templatesDir, dest, "drizzle-postgres");

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

  test("docker-compose assembles the selected services", async () => {
    const manifests = [
      await applyIntegration(templatesDir, dest, "db-postgres"),
      await applyIntegration(templatesDir, dest, "redis"),
    ];
    await writeCompose(dest, manifests);
    const compose = await Bun.file(join(dest, "docker-compose.yml")).text();

    expect(compose).toContain("postgres:");
    expect(compose).toContain("redis:");
    expect(compose).toContain("volumes:");
    expect(compose).toContain("postgres-data:");
  });

  test("gitignore patterns are appended, once", async () => {
    await applyIntegration(templatesDir, dest, "db-sqlite");
    const gitignore = await Bun.file(join(dest, ".gitignore")).text();
    expect(gitignore).toContain("*.db");

    await applyIntegration(templatesDir, dest, "db-sqlite");

    expect(await Bun.file(join(dest, ".gitignore")).text()).toBe(gitignore);
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
