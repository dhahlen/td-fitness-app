import { availableEquipment, exerciseById, familyOf } from "./exercises";
import { prescribeLoad } from "./load";
import { alternativesFor, familiesAvailable, pickExercise, type SelectionContext } from "./selection";
import {
  COMPETENCE_SKILL_CEILING, EXERCISE_ALLOCATION, LARGE_MUSCLES, SCHEMES,
  SESSION_TIME, SKILL_CEILING, type Level,
} from "./standards";
import type {
  Intake, MuscleGroup, PrescribedExercise, SchemeName, SessionPlan,
  SplitResult, VolumeResult,
} from "../types";

/** Splits a total into `buckets` parts, biggest first. */
export function distribute(total: number, buckets: number): number[] {
  if (buckets <= 0) return [];
  const base = Math.floor(total / buckets);
  let rest = total - base * buckets;
  return Array.from({ length: buckets }, () => base + (rest-- > 0 ? 1 : 0));
}

const isLarge = (m: MuscleGroup): boolean => (LARGE_MUSCLES as readonly string[]).includes(m);

/**
 * Week 1 sets per muscle: the bottom of the level's range plus the priority
 * bonus, capped by the range. Starting at the bottom leaves the block a
 * progression lever other than load. Spec section 4.
 */
export function weeklySetTargets(
  intake: Intake,
  split: SplitResult,
  volume: VolumeResult,
): Map<MuscleGroup, number> {
  const priority = new Set(intake.goals.priorityMuscles.slice(0, 2));
  const weekly = new Map<MuscleGroup, number>();
  for (const day of split.days) {
    for (const m of day.muscles) {
      if (weekly.has(m)) continue;
      const range = volume.perMuscle[m];
      const lo = range[0] + (priority.has(m) ? volume.priorityBonus : 0);
      weekly.set(m, Math.min(lo, range[1]));
    }
  }
  return weekly;
}

function schemeFor(compound: boolean, goalScheme: SchemeName): SchemeName {
  if (!compound) return "hypertrophy_isolation";
  return goalScheme === "strength_primary" ? "strength_primary" : "hypertrophy_compound";
}

const restMidpoint = (scheme: SchemeName): number => {
  const [lo, hi] = SCHEMES[scheme].restSec;
  return (lo + hi) / 2;
};

/** Work plus rest plus the walk to the next station. */
export function estimateMinutes(exercises: readonly PrescribedExercise[]): number {
  let seconds = SESSION_TIME.warmupMinutes * 60;
  for (const e of exercises) {
    const rest = restMidpoint(e.scheme) * (e.supersetWith ? SESSION_TIME.supersetRestShare : 1);
    seconds += e.sets * (SESSION_TIME.workSecPerSet + rest) + SESSION_TIME.transitionSecPerExercise;
  }
  return Math.round(seconds / 60);
}

/**
 * Week 1 of the mesocycle, in full.
 *
 * The weekly set budget from volume.perMuscle is spent across the days that
 * train each muscle, then each day's sets are broken into exercises. Clients
 * start at the bottom of their range so the block has somewhere to go. Spec
 * sections 4 and 5.
 */
export function buildSessions(
  intake: Intake,
  level: Level,
  split: SplitResult,
  volume: VolumeResult,
  goalScheme: SchemeName,
  rirIntroducedWeek: number | null,
): SessionPlan[] {
  const ctx: SelectionContext = {
    available: availableEquipment(intake.schedule.equipment),
    injuries: intake.injuries.present ? intake.injuries.sites : [],
    // Level sets the floor, but a client who reports being coached and
    // confident on the barbell lifts has earned them whatever their level.
    skillCeiling: Math.max(SKILL_CEILING[level], COMPETENCE_SKILL_CEILING[intake.history.compoundCompetence]),
  };
  // Beginners train without RIR targets at first, so the field is withheld
  // rather than filled with a number they cannot yet estimate. Spec section 6.
  const withholdRir = rirIntroducedWeek !== null && rirIntroducedWeek > 1;

  const weekly = weeklySetTargets(intake, split, volume);

  // Spread each muscle's week across the days that train it.
  const perDay = new Map<string, number>();
  for (const [m, total] of weekly) {
    const days = split.days.filter((d) => d.muscles.includes(m));
    const shares = distribute(total, days.length);
    days.forEach((d, i) => perDay.set(`${d.day}:${m}`, shares[i] ?? 0));
  }

  const superset = split.name.startsWith("Body-part split");

  return split.days.map((day) => {
    const taken = new Set<string>();
    const usedFamilies = new Set<string>();
    const exercises: PrescribedExercise[] = [];
    const notes: string[] = [];
    const swaps: Array<{ id: string; note: string }> = [];

    // A compound counts a full set for every prime mover it trains, so a
    // Romanian deadlift spends the glute budget as well as the hamstring one.
    // Spec section 4.
    const remaining = new Map<MuscleGroup, number>();
    for (const m of day.muscles) remaining.set(m, perDay.get(`${day.day}:${m}`) ?? 0);

    for (const muscle of day.muscles) {
      const sets = remaining.get(muscle) ?? 0;
      if (sets < EXERCISE_ALLOCATION.minSetsWorthTraining) continue;

      const wanted = Math.round(sets / EXERCISE_ALLOCATION.setsPerExercise);
      const count = Math.min(
        Math.max(1, wanted),
        EXERCISE_ALLOCATION.maxExercisesPerMusclePerSession,
        Math.max(1, Math.floor(sets / EXERCISE_ALLOCATION.minSetsPerExercise)),
        // Never more exercises than there are different movements to give.
        Math.max(1, familiesAvailable(muscle, ctx, taken)),
      );
      const perExercise = distribute(sets, count);

      for (let i = 0; i < count; i++) {
        // A large muscle is worked by compounds and finished with isolation,
        // so a back day gets a row and a pulldown rather than a row and two
        // pullovers. Small muscles are isolation throughout.
        const compound = isLarge(muscle) && i < Math.max(1, count - 1);
        // A different movement is worth more than the right category, so a
        // second shoulder compound gives way to a lateral raise rather than
        // becoming a second overhead press.
        const pick =
          pickExercise(muscle, ctx, taken, { compound, usedFamilies, requireFreshFamily: true }) ??
          pickExercise(muscle, ctx, taken, { compound: !compound, usedFamilies, requireFreshFamily: true }) ??
          pickExercise(muscle, ctx, taken, { compound, usedFamilies, requireFreshFamily: false }) ??
          pickExercise(muscle, ctx, taken, { compound: !compound, usedFamilies, requireFreshFamily: false });
        if (!pick) continue;

        const { exercise, replaced } = pick;
        taken.add(exercise.id);
        usedFamilies.add(familyOf(exercise));
        if (replaced) {
          swaps.push({
            id: exercise.id,
            note: `${replaced.name} was swapped for ${exercise.name} because of what you flagged.`,
          });
        }

        const setCount = perExercise[i] ?? EXERCISE_ALLOCATION.minSetsPerExercise;
        for (const mover of exercise.primeMovers) {
          if (mover !== muscle && remaining.has(mover)) {
            remaining.set(mover, (remaining.get(mover) ?? 0) - setCount);
          }
        }

        const scheme = schemeFor(exercise.pattern !== "isolation" && exercise.pattern !== "carry", goalScheme);
        const spec = SCHEMES[scheme];
        exercises.push({
          exerciseId: exercise.id,
          name: exercise.name,
          alternatives: alternativesFor(exercise, muscle, ctx),
          muscle,
          sets: setCount,
          reps: [spec.reps[0], spec.reps[1]],
          rir: withholdRir ? null : [spec.rir[0], spec.rir[1]],
          restSec: [spec.restSec[0], spec.restSec[1]],
          scheme,
          load: prescribeLoad(exercise, intake, scheme),
        });
      }
    }

    if (superset) pairSupersets(exercises);
    trimToFit(exercises, intake.schedule.sessionMinutes, notes);

    // Trimming can remove the exercise a swap note refers to.
    const kept = new Set(exercises.map((e) => e.exerciseId));
    for (const swap of swaps) if (kept.has(swap.id)) notes.push(swap.note);
    if (withholdRir) {
      notes.push("No reps-in-reserve target for the first four weeks. Hit the prescribed reps and leave judging closeness to failure until you can call it accurately.");
    }

    return {
      day: day.day,
      label: day.label,
      focus: day.focus,
      muscles: day.muscles,
      exercises,
      estimatedMinutes: estimateMinutes(exercises),
      notes,
    };
  });
}

/**
 * Small muscle groups superset on the advanced five-day split, which buys back
 * session time on muscles that recover fast. Spec section 5.
 */
function pairSupersets(exercises: PrescribedExercise[]): void {
  const small = exercises.filter((e) => !isLarge(e.muscle));
  for (let i = 0; i + 1 < small.length; i += 2) {
    const a = small[i];
    const b = small[i + 1];
    if (!a || !b || a.muscle === b.muscle) continue;
    a.supersetWith = b.exerciseId;
    b.supersetWith = a.exerciseId;
  }
}

/**
 * Session length is the field clients are most wrong about, so the plan is cut
 * to fit rather than handed over 20 minutes long. Sets come off the back of
 * the session first, which protects the compounds and the priority muscles
 * that were ordered to the front.
 */
function trimToFit(exercises: PrescribedExercise[], limitMinutes: number, notes: string[]): void {
  if (exercises.length === 0) return;
  const before = estimateMinutes(exercises);
  let guard = 200;

  while (estimateMinutes(exercises) > limitMinutes && guard-- > 0) {
    const target = largestAllocation(exercises);
    if (target) {
      target.sets -= 1;
      continue;
    }
    if (exercises.length <= 1) break;
    exercises.pop();
  }

  const after = estimateMinutes(exercises);
  if (after < before) {
    notes.push(`Trimmed from about ${before} minutes to fit the ${limitMinutes} you have. Adding time back is the first thing to do if you want more volume.`);
  }
}

/** The exercise carrying the most sets, later in the session breaking ties. */
function largestAllocation(exercises: readonly PrescribedExercise[]): PrescribedExercise | null {
  let best: PrescribedExercise | null = null;
  for (const e of exercises) {
    if (e.sets <= EXERCISE_ALLOCATION.minSetsPerExercise) continue;
    if (!best || e.sets >= best.sets) best = e;
  }
  return best;
}

/**
 * What the sessions actually prescribe, after trimming to fit. Every prime
 * mover is credited, so a row counts toward biceps the same as a curl does.
 */
export function deliveredSets(sessions: readonly SessionPlan[]): Map<MuscleGroup, number> {
  const out = new Map<MuscleGroup, number>();
  for (const session of sessions) {
    for (const e of session.exercises) {
      const movers = exerciseById(e.exerciseId)?.primeMovers ?? [e.muscle];
      for (const m of movers) out.set(m, (out.get(m) ?? 0) + e.sets);
    }
  }
  return out;
}
