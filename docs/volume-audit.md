# Volume audit

What the generator actually prescribes, measured against the table in
`docs/program-engine-spec.md` section 4. The spec is the authority. This
records what was checked, so a change that drifts past it is visible.

The numbers below count a set toward every prime mover it trains, which is the
convention the spec sets. A Romanian deadlift is one set of hamstrings and one
set of glutes, not half of each.

## Prescribed ceilings

| Level | Large groups | Small groups | Priority muscles |
|---|---|---|---|
| Beginner | 6 to 10 | 4 to 8 | start +2, same ceiling |
| Novice | 10 to 14 | 8 to 12 | start +3, same ceiling |
| Intermediate | 12 to 18 | 10 to 16 | start +4, same ceiling |
| Advanced | 14 to 22 | 12 to 18 | start +4, same ceiling |
| Elite | 16 to 24 | 12 to 20 | start +4, same ceiling |

Every client starts at the bottom of their range and climbs about two sets per
muscle per week until the ceiling. Modifiers for sleep, stress, age, a deep
deficit, injury and returning from a layoff multiply down from there and never
up. `tests/sessions.test.ts` fails if any profile exceeds a ceiling in week 1
or in any week of the block.

## Measured, week 1

| Profile | Large muscle sets delivered | Peak week in block |
|---|---|---|
| Beginner, 3 days, 60 min | 6 across the board | 8 |
| Beginner, 4 days, 90 min | 6 across the board | 8 |
| Advanced, 5 days, 90 min | 12 to 15 | 22 |
| Advanced, 6 days, 90 min | 13 to 18 | 22 |
| Elite, 6 days, 120 min | 16 to 20 | 24 |

Sets actually performed, which is lower than the credited total because one
compound counts toward several muscles:

| Profile | Working sets a week | Per session |
|---|---|---|
| Beginner, 3 days | 44 | 13 to 18 |
| Advanced, 5 days | around 120 | 20 to 33 |
| Elite, 6 days | around 150 | 21 to 39 |

## Two things this audit found and fixed

**The priority bonus was raising the ceiling.** Spec section 2.4 says a
priority selection biases allocation upward within the level cap, but the code
added the bonus to the top of the range. An elite lifter with a priority muscle
peaked at 28 weekly sets against a published maximum of 24. The bonus now
raises where a muscle starts in its range and leaves the ceiling alone, so
priority muscles accumulate more volume across the block without going past
what the level supports.

**Shared volume leaked across days.** A compound was credited to every prime
mover it trains within a session, but the budget was divided per day up front.
A Romanian deadlift on Monday paid for glutes on Monday and then the engine
paid for them again on Thursday. Beginners were receiving 9 weekly sets of
glutes against a target of 6. The weekly budget is now drawn down as days are
built, and sets a session trim removes are handed back rather than lost.

## One tension the spec does not resolve

The volume table is weekly. The advanced five-day split trains each muscle
once. Together they put a muscle's entire week into one session, which at the
top of the advanced range is 22 sets of chest back to back.

`EXERCISE_ALLOCATION.maxSetsPerMusclePerSession` caps that at 12. Sets past
roughly a dozen in one session are performed too fatigued to pay for what they
cost in recovery. The surplus is dropped rather than prescribed, the session
note says which muscle was capped, and the shortfall is reported on the
program.

This only binds where a split trains a muscle once a week. Twice-weekly splits
are unaffected, and the note points at the fix, which is frequency rather than
more sets in one sitting.

Raising that number is the only change needed to spend the whole week in one
session instead.

## Not checked here

Cardio caps in `CARDIO_CAP_MINUTES` are carried as text in the prescription
rather than computed, so nothing verifies that the stated sessions and
durations multiply out under the cap. They do by inspection. A client who adds
their own cardio on top is outside what the engine sees either way.
