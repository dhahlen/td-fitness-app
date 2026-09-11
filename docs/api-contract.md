# API contract

Base: `https://<worker>.workers.dev`. All bodies JSON.

## Public

### `GET /api/health`
```json
{ "ok": true, "engine": "0.1.0" }
```

### `GET /api/intake/schema`
Returns the PAR-Q+ question text and the engine version so the form does not
hardcode them.

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
}
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
