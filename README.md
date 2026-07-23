# bono

[![npm](https://img.shields.io/npm/v/bono-cli)](https://www.npmjs.com/package/bono-cli)
[![license](https://img.shields.io/npm/l/bono-cli)](LICENSE)
[![bun](https://img.shields.io/badge/runtime-bun-f9f1e1)](https://bun.sh)

Scaffold a Hono API on Bun with the boring setup already done.

```sh
bunx bono-cli new my-api
```

bono asks a few questions, then writes a project that runs. `--base` skips the questions and gives you the base on its own.

## The base

- Feature-based file structure, with a `todos` example to copy from
- pino logging with request IDs
- One error shape everywhere, `AppError` to control it
- zod env validation, crashes at startup instead of at runtime
- Request validation wired to the same error shape
- Rate limiting behind a swappable store
- Health endpoint, CORS, graceful shutdown
- Biome and `bun test` configured

## Integrations

Add these through the prompts, or pass them as flags.

- Postgres, SQLite, or MySQL for the database. Postgres and MySQL use Bun's native SQL client and SQLite uses `bun:sqlite`, so none of them add a driver dependency.
- Drizzle for the ORM, over any of the three databases.
- Redis for caching, using Bun's native client. It also backs rate limiting.
- A `docker-compose.yml` for whichever local services you picked.

## Flags

| Flag | |
| --- | --- |
| `--base` | Skip prompts, base only |
| `--database <postgres\|sqlite\|mysql\|none>` | `none` to wire your own |
| `--orm <drizzle\|none>` | Drizzle, needs a database |
| `--cache <redis\|none>` | Redis, also backs rate limiting |
| `--docker` / `--no-docker` | docker-compose for local services |
| `--no-git` | Skip `git init` |
| `--no-install` | Skip `bun install` |

## Requirements

Bun 1.2 or newer. MySQL needs Bun 1.3.

## License

MIT
