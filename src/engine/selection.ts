import { EXERCISES, canPerform, exerciseById, familyOf, isContraindicated, trains } from "./exercises";
import type { Alternative, EquipmentItem, Exercise, InjurySite, MuscleGroup } from "../types";

export interface SelectionContext {
  available: ReadonlySet<EquipmentItem>;
  injuries: readonly InjurySite[];
  skillCeiling: number;
}

/** Carries are conditioning or grip work, not a slot in a hypertrophy day. */
const isCompound = (e: Exercise): boolean => e.pattern !== "isolation" && e.pattern !== "carry";

/**
 * Library order is the preference order. The first entry that fits the
 * client's equipment, injuries and skill wins, so tuning what gets picked
 * means reordering exercises.ts rather than changing this logic.
 */
function candidates(
  muscle: MuscleGroup,
  ctx: SelectionContext,
  opts: { compound: boolean; ignoreInjuries?: boolean },
): Exercise[] {
  return EXERCISES.filter(
    (e) =>
      trains(e, muscle) &&
      isCompound(e) === opts.compound &&
      e.skill <= ctx.skillCeiling &&
      canPerform(e, ctx.available) &&
      (opts.ignoreInjuries || !isContraindicated(e, ctx.injuries)),
  );
}

export interface Pick {
  exercise: Exercise;
  /** Set when an injury flag pushed the default choice out. */
  replaced?: Exercise;
}

/**
 * Picks the next exercise for a muscle.
 *
 * A movement family already on the page is skipped, so a chest day reaches for
 * an incline press rather than a second flat press. When every family is used
 * the day falls back to library order rather than dropping the sets.
 */
export function pickExercise(
  muscle: MuscleGroup,
  ctx: SelectionContext,
  taken: ReadonlySet<string>,
  opts: { compound: boolean; usedFamilies: ReadonlySet<string>; requireFreshFamily: boolean },
): Pick | null {
  const pool = candidates(muscle, ctx, { compound: opts.compound }).filter((e) => !taken.has(e.id));
  if (pool.length === 0) return null;

  const fresh = pool.find((e) => !opts.usedFamilies.has(familyOf(e)));
  if (!fresh && opts.requireFreshFamily) return null;
  const exercise = fresh ?? pool[0];
  if (!exercise) return null;

  // Would a client without this injury have been given something else?
  const unrestricted = candidates(muscle, ctx, { compound: opts.compound, ignoreInjuries: true })
    .filter((e) => !taken.has(e.id))[0];
  const replaced =
    unrestricted && unrestricted.id !== exercise.id && isContraindicated(unrestricted, ctx.injuries)
      ? unrestricted
      : undefined;

  return replaced ? { exercise, replaced } : { exercise };
}

/**
 * Same muscle, equipment the client also has. This is the "or" in the
 * prescription: whichever station is free.
 */
export function alternativesFor(
  exercise: Exercise,
  muscle: MuscleGroup,
  ctx: SelectionContext,
  limit = 2,
): Alternative[] {
  const usable = (e: Exercise | undefined): e is Exercise =>
    !!e && e.id !== exercise.id && e.skill <= ctx.skillCeiling &&
    canPerform(e, ctx.available) && !isContraindicated(e, ctx.injuries);

  const out: Alternative[] = [];
  const seen = new Set<string>([exercise.id]);

  const add = (e: Exercise, reason: Alternative["reason"]) => {
    if (seen.has(e.id) || out.length >= limit) return;
    seen.add(e.id);
    out.push({ id: e.id, name: e.name, reason });
  };

  for (const id of exercise.substitutions ?? []) {
    const sub = exerciseById(id);
    if (usable(sub)) add(sub, "equipment");
  }

  // Structural fallback so every movement has somewhere to go even when the
  // curated list needs equipment this client does not have.
  if (out.length < limit) {
    for (const e of EXERCISES) {
      if (out.length >= limit) break;
      const sameMovement = familyOf(e) === familyOf(exercise);
      if (usable(e) && trains(e, muscle) && sameMovement && e.loading !== exercise.loading) {
        add(e, "equipment");
      }
    }
  }
  return out;
}

/**
 * How many genuinely different movements the library can offer this client for
 * a muscle. It caps the exercise count so a calf day is a standing and a
 * seated raise rather than three versions of the same raise.
 */
export function familiesAvailable(
  muscle: MuscleGroup,
  ctx: SelectionContext,
  taken: ReadonlySet<string>,
): number {
  const families = new Set<string>();
  for (const compound of [true, false]) {
    for (const e of candidates(muscle, ctx, { compound })) {
      if (!taken.has(e.id)) families.add(familyOf(e));
    }
  }
  return families.size;
}
