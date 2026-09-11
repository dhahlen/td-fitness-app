import {
  DELOAD, FAILED_SESSION_RESET_PCT, LINEAR_INCREMENT_LB,
  RIR_INTRODUCTION_WEEK, SCHEMES, type Level,
} from "./standards";
import type { Intake, ProgressionResult, SchemeName } from "../types";

export function selectProgression(level: Level): ProgressionResult {
  const deloadWeek = DELOAD.everyNWeeks[level];
  const deloadRule = `${DELOAD.volumeMultiplier * 100}% of volume at ${DELOAD.loadMultiplier * 100}% of load. Pulled forward if performance regresses on the same lift for two sessions, or readiness stays under 5 out of 10 for four days.`;

  if (level === "beginner" || level === "novice") {
    return {
      model: "linear",
      description: `Add the smallest available increment every session where all prescribed reps were completed. Two consecutive failed sessions triggers a ${FAILED_SESSION_RESET_PCT * 100}% reset and rebuild.`,
      incrementLb: LINEAR_INCREMENT_LB,
      deloadWeek,
      deloadRule,
      rirIntroducedWeek: RIR_INTRODUCTION_WEEK,
    };
  }
  if (level === "intermediate") {
    return {
      model: "double",
      description:
        "Add reps within the prescribed range across sessions. Once the top of the range is hit on all sets, add load and reset to the bottom. Layer one added set per priority muscle each week of the accumulation block.",
      deloadWeek,
      deloadRule,
      rirIntroducedWeek: null,
    };
  }
  return {
    model: "block",
    description:
      "Four to six weeks of accumulation with rising volume, two to three weeks of intensification with rising load and falling volume, one week deload. Rotate primary exercise variations each mesocycle, hold the movement patterns constant.",
    deloadWeek,
    deloadRule,
    rirIntroducedWeek: null,
  };
}

export function selectScheme(intake: Intake): SchemeName {
  return intake.goals.primary === "strength" ? "strength_primary" : "hypertrophy_compound";
}

export const SCHEME_TABLE = SCHEMES;

/** Estimated 1RM, Epley. Used for progression tracking and phase 2 scoring. */
export function estimate1rm(weight: number, reps: number): number {
  if (reps <= 1) return weight;
  return Math.round(weight * (1 + reps / 30));
}
