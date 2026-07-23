#!/usr/bin/env bun
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { bootCheck, liveCheck, run } from "./verify/checks.ts";
import { buildCombos } from "./verify/combos.ts";

const cli = resolve(import.meta.dir, "../cli/index.ts");

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
