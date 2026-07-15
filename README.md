# bono

[![npm](https://img.shields.io/npm/v/bono-cli)](https://www.npmjs.com/package/bono-cli)
[![license](https://img.shields.io/npm/l/bono-cli)](LICENSE)
[![bun](https://img.shields.io/badge/runtime-bun-f9f1e1)](https://bun.sh)

Scaffold a Hono API on Bun with the boring setup already done.

```sh
bunx bono-cli new my-api
```

Prompts add integrations on top of the base. `--base` skips them.

## The base

- Feature-based file structure, with a `todos` example to copy from
- pino logging with request IDs
- One error shape everywhere, `AppError` to control it
- zod env validation, crashes at startup instead of at runtime
- Request validation wired to the same error shape
- Rate limiting behind a swappable store
- Health endpoint, CORS, graceful shutdown
- Biome and `bun test` configured

## Flags

| Flag | |
| --- | --- |
| `--base` | Skip prompts, base only |
| `--database <postgres\|none>` | |
| `--orm <drizzle\|none>` | |
| `--cache <redis\|none>` | Redis, also backs rate limiting |
| `--docker` / `--no-docker` | docker-compose for local services |
| `--no-git` | Skip `git init` |
| `--no-install` | Skip `bun install` |

## Requirements

Bun 1.2+

## License

MIT
