# API contract

Base: `https://<worker>.workers.dev`. All bodies JSON.

## Public

### `GET /api/health`
```json
{ "ok": true, "engine": "0.1.0" }
```

### `GET /api/intake/schema`
Returns the PAR-Q+ question text, the engine version, and field guidance the
form renders, so none of it is hardcoded in the client.

```json
{ "parq": ["..."], "engineVersion": "0.1.0",
  "guidance": { "maxes": "...", "maxesTestedWithin": "..." } }
```

### `POST /api/intake`
Body: the `Intake` object from `src/types.ts`, validated by `IntakeSchema`.

`201`:
```json
{
  "clientId": "uuid",
  "programId": "uuid",
  "status": "active | pending_clearance | manual_review | archived",
  "program": { "...": "Program" }
}
```

`400` on validation failure:
```json
{ "error": "invalid_intake", "issues": [ { "path": ["metrics","weightKg"], "message": "..." } ] }
```

Status meanings:

| status | what it means | client can start |
|---|---|---|
| `active` | clean intake, program issued | yes |
| `pending_clearance` | a PAR-Q answer was positive | no, doctor sign-off first |
| `manual_review` | pregnancy screen, eating disorder screen, or a target that landed on the absolute calorie floor | no, coach contacts them |
| `archived` | under 18, hard block | no |

### `POST /api/program/preview`
Same body, returns a `Program` without persisting. Used for live preview in the
form. Note this still enforces every safety rule, so a suppressed-nutrition
preview returns `nutrition: null` exactly like the real thing.

## Drafts

Save and resume for a part-finished intake. The token goes in the URL so a
client can start on a phone and finish on a laptop, which localStorage cannot
do. It also means the link grants access to whatever they have typed, so it is
treated as private and the row is deleted 30 days after its last edit.

### `POST /api/draft`
Body `{ "payload": { ... }, "step": 4 }`. Returns `201 { "token": "uuid" }`.
The payload is opaque to the server, and holds raw form state rather than an
`Intake`, since a half-finished intake does not validate.

### `GET /api/draft/:token`
`200 { "payload": {...}, "step": 4, "updatedAt": "..." }`, or `404` with a
message explaining that the link expired.

### `PUT /api/draft/:token`
Body as above. `404` once the draft has been submitted, so a resume link stops
working after the intake lands.

### `POST /api/intake?draft=<token>`
Retires that draft on success.

## Email

`POST /api/intake` sends a receipt through Resend when `RESEND_API_KEY` is set,
and sends nothing when it is not. It never goes to a client the age gate
blocked, and it carries no calorie, macro or program figures at all. A receipt
lands in an inbox that may not be private, and a client whose nutrition was
suppressed must not receive a number by another route.

## Coach

All require `Authorization: Bearer <COACH_API_KEY>`.

### `GET /api/coach/queue`
Clients needing attention, newest first, with an open flag count.

### `GET /api/coach/client/:id`
Client record, most recent program with `output` parsed, and all flags.

### `POST /api/coach/program/:id/approve`
```json
{ "notes": "reduced squat volume, left knee", "startsOn": "2026-09-15" }
```

### `POST /api/coach/flag/:flagId/resolve`
```json
{ "by": "darren" }
```

## The `Program` shape

```ts
{
  generatedAt: string
  engineVersion: string
  safety: { blocked, clearanceRequired, manualReview, suppressNutrition, flags[] }
  level:  { level, score, breakdown, cappedByDetraining }
  split:  { name, daysPerWeek, days[], rationale } | null
  volume: { large, small, priorityBonus, modifier, modifiersApplied, perMuscle } | null
  cardio: { sessionsPerWeek, minutesPerSession, weeklyMinutesCap, zones,
            modalities, placement, note } | null
  progression: { model, description, deloadWeek, deloadRule, rirIntroducedWeek } | null
  nutrition:   { bmr, activityFactor, tdee, targetCalories, phase,
                 targetRatePctPerWeek, floorApplied, floorType, protein,
                 carbs, fat, ... } | null
  scheme: "strength_primary" | "hypertrophy_compound" | ... | null
  sessions: SessionPlan[] | null
  block:    WeekPlan[] | null
}
```

## Sessions

`sessions` is week 1 in full, one entry per training day. Exercises hold for
the mesocycle, so later weeks change sets and load rather than movements.

```ts
{
  day: 1
  label: "Upper A"
  focus: "Press emphasis"
  muscles: MuscleGroup[]
  estimatedMinutes: 52
  notes: string[]                  // swaps made, volume trimmed to fit
  exercises: [{
    exerciseId: "bb_bench"
    name: "Flat barbell bench press"
    alternatives: [{ id, name, reason: "equipment" | "injury" | "preference" }]
    muscle: "chest"
    sets: 4
    reps: [6, 12]
    rir: [1, 3] | null             // null while a beginner is learning to judge it
    restSec: [120, 180]
    scheme: "hypertrophy_compound"
    supersetWith?: "cable_pushdown"
    load: LoadPrescription
  }]
}
```

`alternatives` is the "or" in the prescription: the same movement on equipment
the client also has, for when the station is busy. It is never a different
muscle.

### Load

```ts
{ kind: "percent_1rm", lb: 200, lbRange: [200, 230],
  pctOf1rm: [0.7, 0.8], estimated1rmLb: 287, instruction: "..." }

{ kind: "load_finding", instruction: "..." }   // no max reported
{ kind: "bodyweight",   instruction: "..." }
```

Only the four lifts the intake collects a max for produce a number. Everything
else prescribes a load-finding protocol, and the logged result sets the load
from then on. Do not render an invented weight in place of `load_finding`.

A max also has to be current. `history.maxesTestedWithin` gates what the engine
will do with the numbers a client reports:

| Tested | Sets working weights | Counts toward level |
|---|---|---|
| `"3_weeks"` | yes | yes |
| `"3_months"` | no | yes |
| `"over_3_months"` | no | no |
| absent | no | no |

A max reported but too old to load off returns `load_finding` with an
instruction that says why, so the client is not left wondering where the number
they gave went. Loading off a six month old max is a confident wrong answer,
and finding the weight in session one is a correct one.

## Block

`block` is one entry per week of the requested block.

```ts
{ week: 6, phase: "accumulation" | "intensification" | "deload",
  setMultiplier: 0.5, loadMultiplier: 0.875,
  setsPerMuscle: { chest: 8, quads: 8, ... }, note: "..." }
```

`null` on a section always means safety suppressed it. Never render a fallback
value or a placeholder number in its place. Render the corresponding flag
message instead.

## Calorie floors

`floorApplied` says a floor bound the target. `floorType` says which one, and
they route differently. See spec section 9.3.

| `floorType` | what bound | routing |
|---|---|---|
| `"bmr"` | target fell below calculated BMR | notice flag, program is issued |
| `"absolute"` | target fell below 1,500 kcal for men or 1,200 for women | `manual_review`, coach contacts them |
| `null` | no floor applied | none |

A BMR floor is routine on a large sedentary client in a deficit, since a 25%
cap on the deficit can still land under BMR. It slows the rate rather than
signalling anything wrong, so it does not go to the queue.
