#!/usr/bin/env bun
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { CACHES, DATABASES, ORMS } from "../cli/src/plan.ts";

const cli = resolve(import.meta.dir, "../cli/index.ts");

interface Combo {
  label: string;
  args: string[];
  docker: boolean;
  hasDrizzle: boolean;
  hasRedis: boolean;
}

const combos = buildCombos();

const workDir = mkdtempSync(join(tmpdir(), "bono-verify-"));
let failures = 0;

for (const combo of combos) {
  console.log(`\n=== ${combo.label} ===`);
  const projectDir = join(workDir, combo.label);
  try {
    run(["bun", cli, "new", combo.label, "--no-git", ...combo.args], workDir);
    run(["cp", ".env.example", ".env"], projectDir);
    run(["bun", "run", "check"], projectDir);
    run(["bun", "run", "typecheck"], projectDir);
    run(["bun", "test"], projectDir);
    if (combo.hasDrizzle) {
      run(["bun", "run", "db:generate"], projectDir);
    }
    if (combo.docker) {
      await liveCheck(projectDir, combo.hasDrizzle);
    } else if (combo.hasRedis) {
      console.log("skipped boot check (external Redis required)");
    } else {
      await bootCheck(projectDir);
    }
    console.log(`ok: ${combo.label}`);
  } catch (error) {
    failures += 1;
    console.error(`FAILED: ${combo.label}`);
    console.error(error instanceof Error ? error.message : error);
  } finally {
    rmSync(projectDir, { recursive: true, force: true });
  }
}

rmSync(workDir, { recursive: true, force: true });

if (failures > 0) {
  console.error(`\n${failures} of ${combos.length} combos failed`);
  process.exit(1);
}
console.log(`\nAll ${combos.length} combos verified.`);

function buildCombos(): Combo[] {
  const combos: Combo[] = [];

  for (const database of DATABASES) {
    for (const orm of ORMS) {
      if (database === "none" && orm !== "none") {
        continue;
      }
      for (const cache of CACHES) {
        const hasLocalService = database === "postgres" || cache === "redis";
        const dockerOptions = hasLocalService ? [false, true] : [false];

        for (const docker of dockerOptions) {
          const label = comboLabel(database, orm, cache, docker);
          const args =
            label === "base"
              ? ["--base"]
              : [
                  "--database",
                  database,
                  "--orm",
                  orm,
                  "--cache",
                  cache,
                  docker ? "--docker" : "--no-docker",
                ];

          combos.push({
            label,
            args,
            docker,
            hasDrizzle: orm === "drizzle",
            hasRedis: cache === "redis",
          });
        }
      }
    }
  }

  return combos;
}

function comboLabel(
  database: (typeof DATABASES)[number],
  orm: (typeof ORMS)[number],
  cache: (typeof CACHES)[number],
  docker: boolean,
): string {
  const parts = [
    ...(database === "postgres" ? ["postgres"] : []),
    ...(orm === "drizzle" ? ["drizzle"] : []),
    ...(cache === "redis" ? ["redis"] : []),
    ...(docker ? ["docker"] : []),
  ];
  return parts.join("-") || "base";
}

function run(
  command: string[],
  cwd: string,
  extraEnv: Record<string, string> = {},
): void {
  const result = Bun.spawnSync(command, {
    cwd,
    env: { ...process.env, ...extraEnv },
    stdout: "pipe",
    stderr: "pipe",
  });
  if (result.exitCode !== 0) {
    throw new Error(
      `\`${command.join(" ")}\` exited ${result.exitCode}\n${result.stdout.toString()}\n${result.stderr.toString()}`,
    );
  }
}

async function liveCheck(
  projectDir: string,
  hasDrizzle: boolean,
): Promise<void> {
  if (!dockerAvailable()) {
    console.log("skipped live check (docker not available)");
    return;
  }
  try {
    run(["docker", "compose", "up", "-d", "--wait"], projectDir);
    if (hasDrizzle) {
      run(["bun", "run", "db:migrate"], projectDir);
    }
    await bootCheck(projectDir);
  } finally {
    Bun.spawnSync(["docker", "compose", "down", "-v"], {
      cwd: projectDir,
      stdout: "pipe",
      stderr: "pipe",
    });
  }
}

function dockerAvailable(): boolean {
  try {
    const probe = Bun.spawnSync(["docker", "info"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    return probe.exitCode === 0;
  } catch {
    return false;
  }
}

async function bootCheck(projectDir: string): Promise<void> {
  const port = 3100 + Math.floor(Math.random() * 500);
  const server = Bun.spawn(["bun", "src/index.ts"], {
    cwd: projectDir,
    env: { ...process.env, PORT: String(port) },
    stdout: "pipe",
    stderr: "pipe",
  });
  try {
    for (let attempt = 0; attempt < 40; attempt++) {
      const response = await fetch(`http://localhost:${port}/health`).catch(
        () => null,
      );
      if (response?.status === 200) {
        return;
      }
      await Bun.sleep(100);
    }
    const stderr = await new Response(server.stderr).text();
    throw new Error(`server never answered /health on port ${port}\n${stderr}`);
  } finally {
    server.kill();
  }
}
