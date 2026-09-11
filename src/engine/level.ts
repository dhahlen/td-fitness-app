import {
  COMPETITION_POINTS, CONSISTENCY_POINTS, CONSISTENT_MONTHS_MIDPOINT,
  DETRAINING_MONTHS_THRESHOLD, LEVEL_THRESHOLDS, STRENGTH_STANDARDS,
  YEARS_POINTS, type Level,
} from "./standards";
import type { Intake, LevelResult } from "../types";

function strengthPoints(intake: Intake): number | null {
  const maxes = intake.history.maxes;
  if (!maxes) return null;
  const bw = intake.metrics.weightKg;
  if (!bw) return null;
  const table = STRENGTH_STANDARDS[intake.client.sex];
  const scored: number[] = [];

  for (const lift of ["squat", "bench", "deadlift", "ohp"] as const) {
    const v = maxes[lift];
    if (!v || v <= 0) continue;
    const [nov, inter, adv] = table[lift];
    const ratio = v / bw;
    scored.push(ratio >= adv ? 6 : ratio >= inter ? 4 : ratio >= nov ? 2 : 0);
  }
  if (scored.length === 0) return null;
  return Math.round(scored.reduce((a, b) => a + b, 0) / scored.length);
}

/**
 * Clients self-report their level badly in both directions, so it is scored
 * rather than selected. See docs/program-engine-spec.md section 3.
 */
export function classifyLevel(intake: Intake): LevelResult {
  const breakdown: Record<string, number> = {
    years: YEARS_POINTS[intake.history.yearsTraining],
    consistency: CONSISTENCY_POINTS[intake.history.consistentMonths12],
    competence: intake.history.compoundCompetence,
    competition: COMPETITION_POINTS[intake.history.competition],
  };

  const sp = strengthPoints(intake);
  if (sp !== null) breakdown.relativeStrength = sp;

  const score = Object.values(breakdown).reduce((a, b) => a + b, 0);

  let level: Level = "elite";
  for (const [name, upper] of LEVEL_THRESHOLDS) {
    if (score <= upper) { level = name; break; }
  }

  // Detraining cap. Returning lifters get hurt when treated as their former selves.
  const months = CONSISTENT_MONTHS_MIDPOINT[intake.history.consistentMonths12];
  let cappedByDetraining = false;
  if (months < DETRAINING_MONTHS_THRESHOLD && (level === "intermediate" || level === "advanced" || level === "elite")) {
    level = "novice";
    cappedByDetraining = true;
  }

  return { level, score, breakdown, cappedByDetraining };
}
