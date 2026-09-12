# Strength standards, proposed for approval

`STRENGTH_STANDARDS` in `src/engine/standards.ts` still holds the placeholder
values it shipped with. Nothing below is in the code. It is a proposal for you
to approve, change, or reject, and spec section 13 lists it as your decision.

## What these numbers do

They are the only thing relative strength contributes to level classification.
A reported max scores 6 points at or above the advanced column, 4 at or above
intermediate, 2 at or above novice, and 0 below it. Points are averaged across
the lifts a client reports, so the table moves a client by at most 6 of a
possible 19 points. It does nothing at all for the majority who leave the max
fields blank.

That bounds the risk. Getting these wrong misclassifies lifters who report
numbers, which changes their starting volume and progression model. It does
not change anyone's calorie floor or any safety gate.

## Proposed values, multiples of body weight

These are drawn from published relative strength tables and set so that
"intermediate" means a lifter who has trained properly for two to three years,
not a competitive number. The placeholder table was close on squat and
deadlift and generous on bench and press.

### Male

| Lift | Novice | Intermediate | Advanced | Placeholder was |
|---|---|---|---|---|
| Squat | 1.25 | 1.75 | 2.25 | 1.0 / 1.5 / 2.0 |
| Bench | 0.9 | 1.25 | 1.75 | 0.75 / 1.15 / 1.5 |
| Deadlift | 1.5 | 2.1 | 2.75 | 1.25 / 1.85 / 2.25 |
| Overhead press | 0.55 | 0.8 | 1.0 | 0.5 / 0.7 / 0.9 |

### Female

| Lift | Novice | Intermediate | Advanced | Placeholder was |
|---|---|---|---|---|
| Squat | 0.9 | 1.35 | 1.75 | 0.75 / 1.15 / 1.5 |
| Bench | 0.5 | 0.75 | 1.05 | 0.5 / 0.75 / 1.0 |
| Deadlift | 1.1 | 1.6 | 2.1 | 1.0 / 1.4 / 1.8 |
| Overhead press | 0.35 | 0.55 | 0.7 | 0.35 / 0.5 / 0.65 |

## What this would change in practice

The proposal is harder than the placeholders across the board, most of all on
bench and deadlift. A 200 lb man benching 225 scores intermediate under the
placeholders and novice under this table. The effect is to slow down how fast
the engine promotes people, which is the direction that costs less when it is
wrong: a novice program given to an intermediate is boring for a few weeks, an
advanced program given to a novice gets them hurt.

## What I need from you

Two things the spec asks for and I cannot answer:

1. Does this match your book? You said the bulk of it is beginner to
   intermediate, so the intermediate column is the one that matters most.
2. Should body weight bands adjust these? A 140 lb man and a 240 lb man
   benching the same multiple are not equally strong relative to their peers.
   Adding a band is straightforward if you want it, and it is not in the
   proposal because the spec does not call for it.

Reply with changes or an approval and I will encode exactly what you give me.
