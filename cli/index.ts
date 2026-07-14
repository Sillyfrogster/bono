#!/usr/bin/env bun
import { parseArgs } from "node:util";
import { runNew } from "./src/new.ts";

const HELP = `bono - scaffold a production-ready Hono API on Bun

Usage:
  bono new <name> [options]

Options:
  --base                       Skip all prompts, generate the base
  --database <postgres|none>   Answer the database prompt
  --orm <drizzle|none>         Answer the ORM prompt
  --docker / --no-docker       Answer the docker-compose prompt
  --no-git                     Skip git init
  --no-install                 Skip bun install
  --help, -h                   Show this help
`;

const { values, positionals } = parseArgs({
  args: Bun.argv.slice(2),
  allowPositionals: true,
  options: {
    base: { type: "boolean", default: false },
    database: { type: "string" },
    orm: { type: "string" },
    docker: { type: "boolean", default: false },
    "no-docker": { type: "boolean", default: false },
    "no-git": { type: "boolean", default: false },
    "no-install": { type: "boolean", default: false },
    help: { type: "boolean", short: "h", default: false },
  },
});

const [command, projectName] = positionals;

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

await runNew({
  projectName,
  base: values.base,
  database: values.database,
  orm: values.orm,
  docker: values.docker ? true : values["no-docker"] ? false : undefined,
  git: !values["no-git"],
  install: !values["no-install"],
});
