#!/usr/bin/env bun
import { parseArgs } from "node:util";
import { runNew } from "./src/new.ts";

const HELP = `bono - scaffold a production-ready Hono API on Bun

Usage:
  bono new <name> [options]

Options:
  --base                                    Skip all prompts, generate the base
  --database <postgres|sqlite|mysql|none>   Answer the database prompt
  --orm <drizzle|none>                      Answer the ORM prompt
  --cache <redis|none>                      Answer the cache prompt
  --docker / --no-docker                    Answer the docker-compose prompt
  --no-git                                  Skip git init
  --no-install                              Skip bun install
  --help, -h                                Show this help
`;

const { values, positionals } = parseCliArgs();

const [command, projectName, ...extraPositionals] = positionals;

if (values.help || !command) {
  console.log(HELP);
  process.exit(values.help ? 0 : 1);
}

if (command !== "new") {
  console.error(`Unknown command "${command}".\n\n${HELP}`);
  process.exit(1);
}

if (!projectName) {
  console.error(`Missing project name.\n\nUsage: bono new <name>`);
  process.exit(1);
}

if (extraPositionals.length > 0) {
  failInput(`Unexpected argument "${extraPositionals[0]}".`);
}

if (values.docker && values["no-docker"]) {
  failInput("Choose either --docker or --no-docker, not both.");
}

const hasIntegrationFlags =
  values.database !== undefined ||
  values.orm !== undefined ||
  values.cache !== undefined ||
  values.docker ||
  values["no-docker"];

if (values.base && hasIntegrationFlags) {
  failInput("--base cannot be combined with integration flags.");
}

await runNew({
  projectName,
  base: values.base,
  database: values.database,
  orm: values.orm,
  cache: values.cache,
  docker: values.docker ? true : values["no-docker"] ? false : undefined,
  git: !values["no-git"],
  install: !values["no-install"],
});

function parseCliArgs() {
  try {
    return parseArgs({
      args: Bun.argv.slice(2),
      allowPositionals: true,
      options: {
        base: { type: "boolean", default: false },
        database: { type: "string" },
        orm: { type: "string" },
        cache: { type: "string" },
        docker: { type: "boolean", default: false },
        "no-docker": { type: "boolean", default: false },
        "no-git": { type: "boolean", default: false },
        "no-install": { type: "boolean", default: false },
        help: { type: "boolean", short: "h", default: false },
      },
    });
  } catch (error) {
    failInput(error instanceof Error ? error.message : "Invalid options.");
  }
}

function failInput(message: string): never {
  console.error(message);
  process.exit(1);
}
