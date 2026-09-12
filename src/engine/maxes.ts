import { MAX_RECENCY, MAX_TESTED_WEEKS } from "./standards";
import type { Intake } from "../types";

/** Unknown counts as stale, so a client who skips the question is not loaded off an old number. */
const ageWeeks = (intake: Intake): number => {
  const band = intake.history.maxesTestedWithin;
  return band ? MAX_TESTED_WEEKS[band] : Infinity;
};

const hasAny = (intake: Intake): boolean =>
  Object.values(intake.history.maxes ?? {}).some((v) => typeof v === "number" && v > 0);

/**
 * Whether a reported max may set a working weight.
 *
 * A max from six months ago is not a smaller version of a current one, it is a
 * different number. Percentage loading off it is a confident wrong answer, and
 * finding the weight in the first session is a correct one, so the engine
 * prefers the blank field.
 */
export const usableForLoad = (intake: Intake): boolean =>
  hasAny(intake) && ageWeeks(intake) <= MAX_RECENCY.loadPrescriptionWeeks;

/** Whether a reported max may count toward level classification. */
export const usableForLevel = (intake: Intake): boolean =>
  hasAny(intake) && ageWeeks(intake) <= MAX_RECENCY.levelScoringWeeks;

/** Reported but too old to act on, which is worth saying out loud. */
export const isStale = (intake: Intake): boolean => hasAny(intake) && !usableForLoad(intake);
