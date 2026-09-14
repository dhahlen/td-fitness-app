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

The exercise library lives in `src/engine/exercises.ts` because the engine is
pure and may not read a database. D1 needs the rows too, so
`npm run seed:exercises` regenerates `schema/0002_exercises.sql` from the
module. Change the module, run the script, commit both.

## Layout

```
src/engine/standards.ts   every tunable number, change philosophy here
src/engine/exercises.ts   the exercise library and substitution graph
src/engine/*.ts           pure, deterministic program generation
scripts/                  regenerates the D1 exercise seed from the library
src/validation.ts         zod schema for the intake payload
src/index.ts              Hono API
schema/                   D1 migrations
public/                   intake form, posts to the API and renders the reply
docs/                     spec, API contract, build plan
tests/                    engine tests in node, route tests in workerd
```

Tests run as two projects. `tests/engine.test.ts` is pure and runs in plain
node, which keeps the determinism test honest. `tests/*.api.test.ts` runs in
workerd against a local D1 with `schema/` applied, so route and persistence
behaviour is covered without a deployed database.

## The one rule

`src/engine/safety.ts` runs first and nothing downstream may relax what it
returns. Read `docs/program-engine-spec.md` section 2.2 before changing it.
