# Build plan

Each milestone is shippable on its own. Do not start the next one until the
previous is deployed and working against real data.

## M1: engine and API, no UI changes

Already scaffolded. Finish and verify.

- [ ] `wrangler d1 create program-engine`, paste the id into `wrangler.jsonc`
- [x] Apply `schema/0001_init.sql` locally. Remote still needs the database id
- [x] `POST /api/intake` persists a client, intake, program, and flags
- [x] `POST /api/program/preview` returns a program without persisting
- [x] Coach endpoints behind `COACH_API_KEY`
- [x] All engine tests green, typecheck clean

Done when: you can curl a full intake payload and get a program back, and the
rows land in D1.

Verified locally end to end: intake, re-intake, preview, the four routing
statuses, and every coach endpoint, covered by `tests/routes.api.test.ts`
against a local D1. Creating the remote database is the one step left, and it
needs a Cloudflare account.

## M2: the intake form talks to the API

The form in `public/index.html` currently computes everything client-side. That
duplicates the engine and will drift. Rewire it.

- [x] Form collects into the `Intake` shape from `src/types.ts`
- [x] Max lift fields are opt-in, with a test date that decides whether the
      engine loads off them. The copy is served by `/api/intake/schema`
- [x] Submit posts to `/api/intake`, renders the returned program
- [x] Remove the duplicated client-side calculation entirely
- [x] Save and resume: store a draft keyed by a token in the URL, not in
      localStorage, so people can finish on a different device
- [x] Real email validation and a confirmation send

Done when: the browser does no programming maths at all.

Done. The form converts units, posts, and renders what comes back. Driven end
to end in a real browser: ten steps filled, `POST /api/intake` returns 201, the
page renders four day cards with 26 named exercises and a twelve week block,
and the rows land in D1. Opening the draft link in a fresh browser restores
every answer and the step.

Email validation is the zod `.email()` check on the server, and the receipt
sends through Resend only when `RESEND_API_KEY` is set.

## M3: coach dashboard

- [ ] Queue view: clients pending clearance or manual review, oldest first
- [ ] Client detail: intake, generated program, open flags
- [ ] Edit and approve a program before it goes active
- [ ] Resolve a flag with a note
- [ ] Clearance request email with a document upload link (R2)

Done when: no program reaches a client without passing through this view.

## M4: exercise library and session generation

Up to now the program is an outline. This turns it into actual sessions.

- [x] Seed roughly 120 exercises with the substitution graph populated
- [x] Session generator: fill the split's days with exercises that respect
      equipment, injuries, skill level, and session length
- [x] Superset pairing for small muscle groups on the advanced five-day split
- [x] Starting load protocol: load finding where no max was reported,
      percentage of estimated 1RM for the four lifts the intake collects
- [x] Week-by-week expansion across the block, with the deload placed

Done when: a client can open week 1 day 1 and see named exercises, sets, reps,
and a target load.

124 exercises across 35 movement families, generated into
`schema/0002_exercises.sql` from `src/engine/exercises.ts`. A load number
appears only where a reported max supports one, which was a deliberate call:
see the load section of `docs/api-contract.md`.

Volume delivered by the generator is measured against the spec's table in
`docs/volume-audit.md`, and tests fail if a profile exceeds a level's ceiling.

Still open from this milestone:

- `STRENGTH_STANDARDS` are placeholders. See
  `docs/strength-standards-proposal.md`, which needs your approval.
- Exercise variations do not rotate between mesocycles yet. Spec section 7
  asks for it at advanced and elite, and it needs M5 logging to be useful.

## M5: logging and the adjustment loop

- [ ] Session logging: sets, reps, load, RIR
- [ ] Estimated 1RM tracked per lift over time
- [ ] Weekly check-in form, trend weight rather than single weigh-ins
- [ ] `adjustCalories` wired into the check-in, with the adherence check first
- [ ] Auto-deload trigger from the readiness and performance rules
- [ ] Coach sees the proposed adjustment and approves or overrides

Done when: the program changes on its own in response to real data.

## M6: delivery

- [ ] PDF export of the program. Clients show the PDF to people, which is where
      referrals come from, so it needs to look like something.
- [ ] Client portal: today's session, this week, progress charts
- [ ] Push or email reminders on scheduled training days

## Phase 2: gamification

Not before M5 is stable, because the scoring depends on logged data existing.
See spec section 12. The schema columns are already in `0001_init.sql`:
`baselines`, `leaderboard_consent`, `scores`.

Constraints that are not negotiable when you get there:

- Score rate of change against the individual's own baseline, never absolutes
- Cap points at the prescribed safe rate so faster never outscores correct
- Never leaderboard raw weight lost or body fat percentage
- Cohort by level and goal
- Opt-in visibility, per metric
- Streaks degrade gently rather than resetting to zero
