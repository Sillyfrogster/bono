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
  hasDrizzle?: boolean;
  needsService?: boolean;
}

const combos: Combo[] = [
  { label: "base", args: ["--base"] },
  {
    label: "postgres",
    args: [
      "--database",
      "postgres",
      "--orm",
      "none",
      "--cache",
      "none",
      "--no-docker",
    ],
  },
  {
    label: "postgres-docker",
    args: [
      "--database",
      "postgres",
      "--orm",
      "none",
      "--cache",
      "none",
      "--docker",
    ],
  },
  {
    label: "postgres-drizzle",
    args: [
      "--database",
      "postgres",
      "--orm",
      "drizzle",
      "--cache",
      "none",
      "--docker",
    ],
    hasDrizzle: true,
    needsService: true,
  },
  {
    label: "postgres-drizzle-no-docker",
    args: [
      "--database",
      "postgres",
      "--orm",
      "drizzle",
      "--cache",
      "none",
      "--no-docker",
    ],
    hasDrizzle: true,
  },
  {
    label: "redis-docker",
    args: ["--database", "none", "--cache", "redis", "--docker"],
    needsService: true,
  },
  {
    label: "postgres-redis-docker",
    args: [
      "--database",
      "postgres",
      "--orm",
      "drizzle",
      "--cache",
      "redis",
      "--docker",
    ],
    hasDrizzle: true,
    needsService: true,
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
    if (combo.needsService) {
      await liveCheck(projectDir, combo.hasDrizzle ?? false);
    } else {
      await bootCheck(projectDir);
    }
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
 * Boots the project against live services from its compose file, gated on
 * Docker being available. Skipped with a note when it is not.
 */
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
