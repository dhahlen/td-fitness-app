import { ageFrom, evaluateSafety } from "./safety";
import { classifyLevel } from "./level";
import { computeNutrition } from "./nutrition";
import { computeVolume } from "./volume";
import { selectSplit, sixDayEligible } from "./split";
import { prescribeCardio } from "./cardio";
import { selectProgression, selectScheme } from "./progression";
import { buildSessions, deliveredSets, weeklySetTargets } from "./session";
import { expandBlock } from "./block";
import { VOLUME_MODIFIER_THRESHOLDS } from "./standards";
import type { Intake, Program } from "../types";

export const ENGINE_VERSION = "0.1.0";

/**
 * Single entry point. Deterministic and pure: same intake in, same program
 * out. No I/O, no dates from outside except `now`, so it is fully testable.
 *
 * Order matters. Safety runs first and nothing downstream may relax it.
 */
export function generateProgram(intake: Intake, now = new Date()): Program {
  const safety = evaluateSafety(intake, now);
  const age = ageFrom(intake.client.dob, now);
  const level = classifyLevel(intake);

  if (safety.blocked) {
    return {
      generatedAt: now.toISOString(),
      engineVersion: ENGINE_VERSION,
      safety, level,
      split: null, volume: null, cardio: null, progression: null, nutrition: null,
      scheme: null, sessions: null, block: null,
    };
  }

  const nutrition = safety.suppressNutrition ? null : computeNutrition(intake, level.level, age);
  const deepDeficit = nutrition
    ? nutrition.targetCalories < nutrition.tdee * VOLUME_MODIFIER_THRESHOLDS.deepDeficitPctOfTdee
    : false;

  // Six-day programs are gated on recovery. Downgrade rather than refuse.
  const effective: Intake =
    intake.schedule.daysPerWeek === 6 && !sixDayEligible(intake, level.level)
      ? { ...intake, schedule: { ...intake.schedule, daysPerWeek: 5 } }
      : intake;

  if (effective.schedule.daysPerWeek !== intake.schedule.daysPerWeek) {
    safety.flags.push({
      code: "volume_reduced",
      severity: "notice",
      message: "Six days requires at least seven hours of sleep and stress under 7 out of 10. Started at five days instead, with room to add the sixth once recovery supports it.",
    });
  }

  const volume = computeVolume(effective, level.level, age, deepDeficit);
  if (volume.modifiersApplied.length > 0) {
    safety.flags.push({
      code: "volume_reduced",
      severity: "notice",
      message: `Starting volume reduced ${Math.round((1 - volume.modifier) * 100)}% for: ${volume.modifiersApplied.join(", ")}.`,
    });
  }
  if (nutrition?.floorApplied) {
    safety.flags.push({
      code: "calorie_floor",
      severity: "notice",
      message: `Requested rate would have pushed intake below the safe floor. Set at ${nutrition.targetCalories} kcal instead, which means slower loss.`,
    });
  }

  const split = selectSplit(effective, level.level);
  const progression = selectProgression(level.level);
  const scheme = selectScheme(effective);
  const sessions = buildSessions(
    effective, level.level, split, volume, scheme, progression.rirIntroducedWeek,
  );

  // Session length can cost real volume, so say which muscles came up short
  // rather than letting the trim disappear into the plan.
  const target = weeklySetTargets(effective, split, volume);
  const delivered = deliveredSets(sessions);
  const short = [...target]
    .filter(([muscle, want]) => (delivered.get(muscle) ?? 0) < want)
    .map(([muscle, want]) => `${muscle} ${delivered.get(muscle) ?? 0} of ${want}`);

  if (short.length > 0) {
    safety.flags.push({
      code: "volume_reduced",
      severity: "notice",
      message: `${effective.schedule.sessionMinutes} minute sessions do not hold the full prescription, so weekly sets landed at ${short.join(", ")}. A longer session or an extra day carries the rest.`,
    });
  }

  return {
    generatedAt: now.toISOString(),
    engineVersion: ENGINE_VERSION,
    safety,
    level,
    split,
    volume,
    cardio: prescribeCardio(effective, level.level),
    progression,
    nutrition,
    scheme,
    sessions,
    block: expandBlock(effective, level.level, split, volume, progression),
  };
}

export * from "./standards";
export { PARQ_QUESTIONS } from "./safety";
export { EXERCISES, exerciseById, availableEquipment } from "./exercises";
export { usableForLoad, usableForLevel } from "./maxes";
export { estimate1rm } from "./progression";
export { adjustCalories } from "./nutrition";
