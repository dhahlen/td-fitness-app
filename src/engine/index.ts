import { ageFrom, evaluateSafety } from "./safety";
import { classifyLevel } from "./level";
import { computeNutrition } from "./nutrition";
import { computeVolume } from "./volume";
import { selectSplit, sixDayEligible } from "./split";
import { prescribeCardio } from "./cardio";
import { selectProgression, selectScheme } from "./progression";
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
      split: null, volume: null, cardio: null, progression: null, nutrition: null, scheme: null,
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

  return {
    generatedAt: now.toISOString(),
    engineVersion: ENGINE_VERSION,
    safety,
    level,
    split: selectSplit(effective, level.level),
    volume,
    cardio: prescribeCardio(effective, level.level),
    progression: selectProgression(level.level),
    nutrition,
    scheme: selectScheme(effective),
  };
}

export * from "./standards";
export { PARQ_QUESTIONS } from "./safety";
export { estimate1rm } from "./progression";
export { adjustCalories } from "./nutrition";
