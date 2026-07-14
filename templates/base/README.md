# bono-app

Hono on Bun, scaffolded by [bono](https://www.npmjs.com/package/bono-cli).

```sh
cp .env.example .env
bun run dev
```

## Scripts

| | |
| --- | --- |
| `bun run dev` | start with watch |
| `bun run start` | start |
| `bun test` | tests |
| `bun run check` | lint + format |
| `bun run typecheck` | tsc |

## Structure

```
src/
  index.ts       server start + shutdown
  app.ts         middleware + route mounting
  config/env.ts  env validation
  lib/           logger, errors, validate helper
  middleware/    request logging, rate limiting
  features/      one folder per feature
```

`features/todos` is the example. Copy the pattern, then delete it.

## Errors

Everything error-shaped comes back as:

```json
{ "error": { "code": "TODO_NOT_FOUND", "message": "..." }, "requestId": "..." }
```

Throw `AppError(status, code, message)` anywhere. Anything else thrown is a 500 with the details kept out of the response.

## Rate limiting

In-memory, 100 req/min per IP. Implement `RateLimitStore` (`src/middleware/rate-limit.ts`) to back it with something shared.
