import { existsSync } from "node:fs";
import { resolve } from "node:path";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { applyIntegration, copyBase, writeCompose } from "./apply.ts";
import type { IntegrationManifest } from "./manifest.ts";
import {
  type Answers,
  type Cache,
  type Database,
  integrationsFor,
  type Orm,
  validateAnswers,
} from "./plan.ts";

export interface NewOptions {
  projectName: string;
  base: boolean;
  database?: string;
  orm?: string;
  cache?: string;
  docker?: boolean;
  git: boolean;
  install: boolean;
}

export async function runNew(options: NewOptions): Promise<void> {
  const dest = resolve(process.cwd(), options.projectName);
  const templatesDir = resolve(import.meta.dir, "../../templates");

  if (!/^[a-z0-9][a-z0-9-_]*$/i.test(options.projectName)) {
    failInput(
      `"${options.projectName}" is not a valid project name (letters, numbers, - and _).`,
    );
  }
  if (existsSync(dest)) {
    failInput(`${dest} already exists.`);
  }

  p.intro(pc.bold("bono"));

  const answers = await collectAnswers(options);
  const validationError = validateAnswers(answers);
  if (validationError) {
    failInput(validationError);
  }

  const spinner = p.spinner();
  spinner.start("Copying base");
  await copyBase(templatesDir, dest, options.projectName);
  const applied: IntegrationManifest[] = [];
  for (const name of integrationsFor(answers)) {
    spinner.message(`Adding ${name}`);
    applied.push(await applyIntegration(templatesDir, dest, name));
  }
  if (answers.docker) {
    await writeCompose(dest, applied);
  }
  spinner.stop("Project files written");

  if (options.git) {
    run(["git", "init", "-b", "main"], dest, "git init failed");
  }
  if (options.install) {
    const installSpinner = p.spinner();
    installSpinner.start("Installing dependencies");
    run(["bun", "install"], dest, "bun install failed");
    installSpinner.stop("Dependencies installed");
  }

  const nextSteps = [
    `cd ${options.projectName}`,
    ...(options.install ? [] : ["bun install"]),
    "cp .env.example .env",
    ...(answers.docker ? ["docker compose up -d"] : []),
    "bun run dev",
  ].join("\n");
  p.note(nextSteps, "Next steps");
  p.outro("Done.");
}

async function collectAnswers(options: NewOptions): Promise<Answers> {
  // Flags answer prompts directly; --base or a non-interactive terminal
  // answers everything not given with "none".
  const skipPrompts = options.base || !process.stdout.isTTY;

  const database =
    (options.database as Database | undefined) ??
    (skipPrompts ? "none" : await askDatabase());

  const orm =
    database === "none"
      ? "none"
      : ((options.orm as Orm | undefined) ??
        (skipPrompts ? "none" : await askOrm()));

  const cache =
    (options.cache as Cache | undefined) ??
    (skipPrompts ? "none" : await askCache());

  const hasLocalService = database === "postgres" || cache === "redis";
  const docker = hasLocalService
    ? (options.docker ?? (skipPrompts ? false : await askDocker()))
    : false;

  return { database, orm, cache, docker };
}

async function askDatabase(): Promise<Database> {
  const choice = await p.select({
    message: "Database?",
    options: [
      {
        value: "postgres" as const,
        label: "Postgres",
        hint: "Bun-native client, zero dependencies",
      },
      {
        value: "none" as const,
        label: "None",
        hint: "set one up yourself later",
      },
    ],
  });
  return cancelled(choice);
}

async function askCache(): Promise<Cache> {
  const choice = await p.select({
    message: "Cache?",
    options: [
      {
        value: "redis" as const,
        label: "Redis",
        hint: "Bun-native client, also backs rate limiting",
      },
      {
        value: "none" as const,
        label: "None",
        hint: "in-memory rate limiting",
      },
    ],
  });
  return cancelled(choice);
}

async function askDocker(): Promise<boolean> {
  const choice = await p.confirm({
    message: "docker-compose for local services?",
  });
  return cancelled(choice);
}

async function askOrm(): Promise<Orm> {
  const choice = await p.select({
    message: "ORM?",
    options: [
      {
        value: "drizzle" as const,
        label: "Drizzle",
        hint: "schema, migrations, typed queries",
      },
      {
        value: "none" as const,
        label: "None",
        hint: "raw SQL through the client",
      },
    ],
  });
  return cancelled(choice);
}

function cancelled<T>(value: T | symbol): T {
  if (p.isCancel(value)) {
    p.cancel("Cancelled, nothing was created.");
    process.exit(1);
  }
  return value;
}

function run(command: string[], cwd: string, errorMessage: string): void {
  const result = Bun.spawnSync(command, {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  if (result.exitCode !== 0) {
    p.log.error(`${errorMessage}:\n${result.stderr.toString()}`);
    process.exit(1);
  }
}

// Input mistakes are not failures; keep them calm, not red.
function failInput(message: string): never {
  p.log.warn(message);
  process.exit(1);
}
