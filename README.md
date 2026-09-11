# Program engine

Intake to training and nutrition program generator. Cloudflare Workers, Hono, D1.

## Quick start

```bash
npm install
npx wrangler d1 create program-engine     # paste database_id into wrangler.jsonc
npm run db:local
npm run dev
```

Tests: `npm test`. Typecheck: `npm run typecheck`.

## Layout

```
src/engine/standards.ts   every tunable number, change philosophy here
src/engine/*.ts           pure, deterministic program generation
src/validation.ts         zod schema for the intake payload
src/index.ts              Hono API
schema/                   D1 migrations
public/                   intake form
docs/                     spec, API contract, build plan
tests/                    engine tests, 22 of them, all pure
```

## The one rule

`src/engine/safety.ts` runs first and nothing downstream may relax what it
returns. Read `docs/program-engine-spec.md` section 2.2 before changing it.
