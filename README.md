# bono

[![CI](https://github.com/Sillyfrogster/bono/actions/workflows/ci.yml/badge.svg)](https://github.com/Sillyfrogster/bono/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/bono-cli)](https://www.npmjs.com/package/bono-cli)
[![downloads](https://img.shields.io/npm/dm/bono-cli)](https://www.npmjs.com/package/bono-cli)
[![license](https://img.shields.io/npm/l/bono-cli)](LICENSE)
[![bun](https://img.shields.io/badge/runtime-bun-f9f1e1)](https://bun.sh)

Scaffold a [Hono](https://hono.dev) API on [Bun](https://bun.sh) with the boring setup already done.

![bono generating a Postgres, Drizzle and Redis project](https://raw.githubusercontent.com/Sillyfrogster/bono/main/.github/demo.gif)

bono asks up to four questions, writes the project, runs `bun install` and `git init`, and tells you what to run next. What you get back runs straight away and comes with logging, error handling, env validation, request validation, rate limiting and tests.

## Quick start

```sh
bunx bono-cli new my-api
cd my-api
cp .env.example .env
bun run dev
```

```sh
curl localhost:3000/health
# {"status":"ok"}
```

To skip the questions and take the base on its own:

```sh
bunx bono-cli new my-api --base
```

## What you get

Every generated project starts with this, whatever you answer.

| | | |
| --- | --- | --- |
| Logging | pino, with a request ID on every log line and every error response | `src/lib/logger.ts` |
| Errors | one JSON shape for every failure, `AppError(status, code, message)` to control it | `src/lib/errors.ts` |
| Config | env parsed through zod at startup, so a bad value stops the process instead of surfacing later | `src/config/env.ts` |
| Validation | a `validate()` helper around `@hono/zod-validator`, so 400s use that same error shape | `src/lib/validate.ts` |
| Rate limiting | 100 requests per minute per IP, in memory, behind a `RateLimitStore` interface you can swap | `src/middleware/rate-limit.ts` |
| Lifecycle | health endpoint, CORS, graceful shutdown on SIGINT and SIGTERM | `src/index.ts` |
| Tests | `bun test`, calling the app directly so nothing has to listen on a port | `src/app.test.ts` |
| Tooling | Biome for lint and format, `tsc --noEmit` for types | `biome.json` |

## The example feature

`src/features/todos` is a working CRUD feature, there to be copied and then deleted. It is three files: routes, zod schemas, service.

| | |
| --- | --- |
| `GET /health` | liveness |
| `GET /todos` | list |
| `GET /todos/:id` | one, 404 as `TODO_NOT_FOUND` |
| `POST /todos` | create, 201 |
| `PATCH /todos/:id` | update |
| `DELETE /todos/:id` | delete, 204 |

Everything that fails comes back the same way, whether it was thrown by a handler, raised by validation, or missed by the router:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid json",
    "details": [{ "path": "title", "message": "Too small: expected string to have >=1 characters" }]
  },
  "requestId": "01JZ8Q3K2M4N5P6R7S8T9V0W1X"
}
```

The same `requestId` is on the pino log line for that request, so a report from a user leads straight to the log.

## Project structure

```
src/
  index.ts             server start, graceful shutdown
  app.ts               middleware and route mounting
  config/env.ts        zod env schema
  lib/                 logger, errors, validate helper
  middleware/          request logging, rate limiting
  features/
    todos/             the example feature, copy then delete
      todos.routes.ts
      todos.schema.ts
      todos.service.ts
```

One folder per feature. `app.ts` is where they get mounted.

## Integrations

Pick these at the prompts, or pass them as flags.

| | |
| --- | --- |
| **Postgres** | Bun's native SQL client, no driver dependency |
| **SQLite** | `bun:sqlite`, a local file, no driver dependency |
| **MySQL** | Bun's native SQL client, no driver dependency |
| **Drizzle** | schema, migrations and typed queries over any of the three |
| **Redis** | Bun's native client, adds `cacheGet` / `cacheSet` / `cacheDelete`, and backs rate limiting once installed |
| **Docker** | a `docker-compose.yml` holding only the services you picked |

Each one adds its files, its env keys, its scripts and a section in the generated project's README.

> [!NOTE]
> Choosing Redis also moves rate limiting from memory to Redis. There is no flag for it and no code to change.

## CLI

```
bono new <name> [options]
```

| Flag | |
| --- | --- |
| `--base` | Skip all prompts, base only. Cannot be combined with the flags below |
| `--database <postgres\|sqlite\|mysql\|none>` | `none` to wire your own |
| `--orm <drizzle\|none>` | Needs a database |
| `--cache <redis\|none>` | Redis also backs rate limiting |
| `--docker` / `--no-docker` | docker-compose for the local services you picked |
| `--no-git` | Skip `git init` |
| `--no-install` | Skip `bun install` |
| `--help`, `-h` | Show help |

Any flag you pass answers that prompt, and bono only asks about what is left. The ORM question is skipped when there is no database, and the docker question is skipped when nothing you picked runs as a local service.

Bad input fails before any file is written, and a failure part way through deletes the directory rather than leaving half a project behind.

## Non-interactive use

bono skips every prompt when stdout is not a TTY, and answers anything you did not pass with `none`. Scripts and CI runs work without `--base`:

```sh
bunx bono-cli new my-api --database postgres --orm drizzle --cache redis --docker --no-install
```

## Scope

bono runs once and then it is gone. The generated project has no dependency on bono, no config file pointing back at it, and no update command. It is your code from that point on.

It does not give you auth, deployment config, a frontend, or an opinion about your database schema beyond one example table.

## Requirements

Bun 1.2 or newer. MySQL needs Bun 1.3.

## How it is tested

`bun run verify` generates all 25 valid answer combinations and, for each one, installs it, runs Biome, runs `tsc`, runs its tests, generates Drizzle migrations where Drizzle is present, then boots the server and waits for `/health` to answer. Combinations with docker-compose bring the real service up first, apply migrations against it, and tear it down after.

Lint, types and the CLI tests run on every push and pull request. The full sweep runs before every publish.
