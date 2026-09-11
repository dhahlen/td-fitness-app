# Working notes for Claude Code

Read this before writing anything. Then read `docs/program-engine-spec.md`,
which is the domain authority for every training and nutrition rule in here.

## What this is

A fitness coaching intake that generates individualised training and nutrition
programs. Clients range from complete beginners to competitive bodybuilders,
but the bulk of the book is beginner to intermediate. Phase 1 is intake plus
program generation. Phase 2 is gamification, scoped in spec section 12 but not
built yet.

## Stack

Cloudflare Workers, Hono, D1, Workers Assets for the static frontend, zod for
validation, vitest for tests. TypeScript strict, `noUncheckedIndexedAccess` on.
No build step for the frontend right now, it is a single HTML file in `public/`.

## Non-negotiables

These are safety rules, not preferences. Do not relax them to make a test pass
or a feature simpler.

1. **`evaluateSafety` runs first and its result is final.** Nothing downstream
   may widen `blocked`, `clearanceRequired`, `manualReview`, or
   `suppressNutrition`. If a feature seems to need that, it is wrong.
2. **Under 18 is a hard block.** No program, no nutrition, no exceptions.
3. **A positive eating disorder screen suppresses every calorie and macro
   number.** Training still generates. Never emit a substitute number, a range,
   or a "rough guide" in its place.
4. **Calorie floors in `LIMITS` are enforced in code.** Never below BMR, never
   below the absolute floor, never a deficit beyond 25% of TDEE, never a loss
   rate above 1% of body weight per week. There is no input, flag, or coach
   override that bypasses these.
5. **Pregnancy and postpartum route to manual coach review.** Do not auto-issue.
6. **The engine is pure.** No fetch, no database, no `new Date()` without the
   injectable `now` argument. Same intake in, same program out, always. The
   determinism test enforces this.

## Conventions

- **All tunable numbers live in `src/engine/standards.ts`.** If you need a
  number in engine logic, put it there first and import it. A magic number in
  `volume.ts` or `nutrition.ts` is a bug.
- Engine modules are single-purpose and export named functions. `index.ts` in
  `src/engine` composes them and is the only entry point callers use.
- Types live in `src/types.ts`. The zod schema in `src/validation.ts` must stay
  in sync with the `Intake` interface. When you change one, change both.
- Never mutate an `intakes` row. Re-intake inserts a new row so the history of
  what drove each program survives.
- Comments explain *why*, not *what*. The spec explains the reasoning; a comment
  should point at the spec section rather than restate it.

## Build order

Follow `docs/build-plan.md`. Do not jump ahead to phase 2, and do not build the
exercise library before the generator that consumes it is working end to end.

## Style

Plain, direct prose in any user-facing copy, docs, or error messages. No em
dashes. No "not just X, it's Y". No three-item lists used as a rhetorical
device. Sentence case headings. Errors say what happened and what to do, and
they do not apologise.

## What to ask about rather than guess

- Strength standards in `STRENGTH_STANDARDS`. These are placeholders and need
  to reflect the real client base. Flag it, do not invent values.
- Anything that would change a safety threshold.
- Whether a client-facing string is the coach's voice or the product's voice.
