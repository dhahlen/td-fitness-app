import { isStale, usableForLoad } from "./maxes";
import { LB_PER_KG, LOAD, MAX_RECENCY, SCHEMES } from "./standards";
import type { Exercise, Intake, LoadPrescription, MainLift, SchemeName } from "../types";

const toLb = (kg: number): number => kg * LB_PER_KG;

/** Rounds to a jump the gym can actually make. */
export function roundLoad(lb: number, loading: Exercise["loading"]): number {
  const step = loading === "barbell" || loading === "smith" ? LOAD.roundingLb : LOAD.smallRoundingLb;
  return Math.round(lb / step) * step;
}

const reportedMaxLb = (intake: Intake, lift: MainLift): number | null => {
  if (!usableForLoad(intake)) return null;
  const kg = intake.history.maxes?.[lift];
  return kg && kg > 0 ? toLb(kg) : null;
};

/**
 * Load comes off a current reported max where one exists, and off a
 * load-finding set where it does not.
 *
 * Predicting a stranger's working weight from body weight is guesswork, and a
 * wrong number in week one is worse than no number: too light wastes the week,
 * too heavy is how people get hurt. So an exercise without a usable max
 * prescribes a protocol, and the logged result sets every load after it.
 * A max the client reported but tested too long ago counts as not having one.
 * Spec section 11.
 */
export function prescribeLoad(
  exercise: Exercise,
  intake: Intake,
  scheme: SchemeName,
): LoadPrescription {
  if (exercise.loading === "bodyweight" && !exercise.mainLift) {
    return {
      kind: "bodyweight",
      instruction: "Body weight. Add load once you clear the top of the rep range on every set.",
    };
  }

  const max = exercise.mainLift ? reportedMaxLb(intake, exercise.mainLift) : null;
  if (max !== null) {
    const [lo, hi] = SCHEMES[scheme].pct1rm;
    const floor = exercise.loading === "barbell" || exercise.loading === "smith" ? LOAD.barbellLb : 0;
    const low = Math.max(floor, roundLoad(max * lo, exercise.loading));
    const high = Math.max(floor, roundLoad(max * hi, exercise.loading));
    const e1rm = Math.round(max);
    return {
      kind: "percent_1rm",
      lb: low,
      lbRange: [low, high],
      pctOf1rm: [lo, hi],
      estimated1rmLb: e1rm,
      instruction: `Start at ${low} lb, which is ${Math.round(lo * 100)}% of your ${e1rm} lb max. Work up to ${high} lb across the block.`,
    };
  }

  const band = exercise.loading === "band";
  const finding = band
    ? `Pick a band that makes ${LOAD.findingReps} reps hard but leaves about ${LOAD.findingRir} in the tank. Move to a heavier band when you clear the top of the range.`
    : `Warm up over ${LOAD.warmupSets} sets, then find a weight where ${LOAD.findingReps} reps leaves about ${LOAD.findingRir} in the tank. That is your working weight, and every load after this comes from what you log.`;

  // Say why a number the client gave us is not on the page.
  const stale = exercise.mainLift && isStale(intake)
    ? `The max you reported was not tested in the last ${MAX_RECENCY.loadPrescriptionWeeks} weeks, so we are finding the weight rather than loading off it. `
    : "";

  return { kind: "load_finding", instruction: stale + finding };
}
