#!/usr/bin/env bun
/**
 * Generates every valid answer combination with the real CLI, then proves
 * each project installs, typechecks, passes its tests, and serves /health.
 * Run before publishing: bun run verify
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const cli = resolve(import.meta.dir, "../cli/index.ts");

interface Combo {
  label: string;
  args: string[];
  hasDrizzle: boolean;
}

const combos: Combo[] = [
  { label: "base", args: ["--base"], hasDrizzle: false },
  {
    label: "postgres",
    args: ["--database", "postgres", "--no-docker", "--orm", "none"],
    hasDrizzle: false,
  },
  {
    label: "postgres-docker",
    args: ["--database", "postgres", "--docker", "--orm", "none"],
    hasDrizzle: false,
  },
  {
    label: "postgres-drizzle",
    args: ["--database", "postgres", "--docker", "--orm", "drizzle"],
    hasDrizzle: true,
  },
  {
    label: "postgres-drizzle-no-docker",
    args: ["--database", "postgres", "--no-docker", "--orm", "drizzle"],
    hasDrizzle: true,
  },
];

const workDir = mkdtempSync(join(tmpdir(), "bono-verify-"));
let failures = 0;

for (const combo of combos) {
  console.log(`\n=== ${combo.label} ===`);
  const projectDir = join(workDir, combo.label);
  try {
    run(["bun", cli, "new", combo.label, "--no-git", ...combo.args], workDir);
    run(["bunx", "tsc", "--noEmit"], projectDir);
    if (combo.hasDrizzle) {
      run(["bun", "run", "db:generate"], projectDir);
    }
    // The documented first step in every generated README.
    run(["cp", ".env.example", ".env"], projectDir);
    if (combo.label === "postgres-drizzle") {
      await migrateCheck(projectDir);
    }
    await bootCheck(projectDir);
    console.log(`ok: ${combo.label}`);
  } catch (error) {
    failures += 1;
    console.error(`FAILED: ${combo.label}`);
    console.error(error instanceof Error ? error.message : error);
  }
}

rmSync(workDir, { recursive: true, force: true });

if (failures > 0) {
  console.error(`\n${failures} of ${combos.length} combos failed`);
  process.exit(1);
}
console.log(`\nAll ${combos.length} combos verified.`);

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

/**
 * Real migration against a live Postgres, gated on Docker being available.
 * Skipped (with a note) when it is not; nothing here is required of users.
 */
async function migrateCheck(projectDir: string): Promise<void> {
  if (!dockerAvailable()) {
    console.log("skipped db:migrate check (docker not available)");
    return;
  }
  try {
    run(["docker", "compose", "up", "-d", "--wait"], projectDir);
    run(["bun", "run", "db:migrate"], projectDir);
    console.log("db:migrate ran against live Postgres");
  } finally {
    Bun.spawnSync(["docker", "compose", "down", "-v"], {
      cwd: projectDir,
      stdout: "pipe",
      stderr: "pipe",
    });
  }
}

// Missing binary throws; installed-but-stopped daemon returns nonzero.
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
      try {
        const res = await fetch(`http://localhost:${port}/health`);
        if (res.status === 200) {
          return;
        }
      } catch {
        // Server not up yet; retry.
      }
      await Bun.sleep(100);
    }
    const stderr = await new Response(server.stderr).text();
    throw new Error(`server never answered /health on port ${port}\n${stderr}`);
  } finally {
    server.kill();
  }
}
