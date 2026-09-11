import {
  CARDIO_CAP_MINUTES, CARDIO_HEALTH_FLOOR_MINUTES,
  CONCURRENT_SEPARATION_HOURS, LOW_IMPACT_MODALITIES, type Level,
} from "./standards";
import type { CardioResult, Intake } from "../types";

const IMPACT_SENSITIVE = new Set(["knee", "hip", "ankle", "lower_back"]);

/**
 * Cardio is prescribed, not bolted on.
 *
 * The interference effect is real but its magnitude depends on choices we
 * control: total endurance volume, modality, and whether lifting comes first
 * when both fall in one session. Running interferes more than cycling.
 * See docs/program-engine-spec.md section 8.
 */
export function prescribeCardio(intake: Intake, level: Level): CardioResult {
  const goal = intake.goals.primary;
  const beginner = level === "beginner" || level === "novice";
  const jointLimited = intake.injuries.present && intake.injuries.sites.some((s) => IMPACT_SENSITIVE.has(s));

  const available = intake.schedule.cardioEquipment;
  const preferred = LOW_IMPACT_MODALITIES.filter((m) => {
    if (m === "bike") return available.includes("bike");
    if (m === "rower") return available.includes("rower");
    if (m === "elliptical") return available.includes("elliptical");
    if (m === "incline_walk") return available.includes("treadmill") || available.includes("outdoors");
    return false;
  });
  const modalities = preferred.length ? [...preferred] : ["incline_walk"];
  if (!jointLimited && available.includes("outdoors") && goal !== "mass") modalities.push("easy_run");

  const separation = `If cardio lands on a lifting day, lift first or separate the sessions by at least ${CONCURRENT_SEPARATION_HOURS} hours.`;

  if (goal === "fatloss" && beginner) {
    return {
      sessionsPerWeek: "3",
      minutesPerSession: "25 to 35",
      weeklyMinutesCap: CARDIO_CAP_MINUTES.hypertrophyPriority,
      zones: "Zone 2, 60 to 70% of max heart rate, conversational pace",
      modalities,
      placement: "Non-lifting days. " + separation,
      note: "Also set a daily step target of 8,000 to 10,000. Steps will contribute more to the weekly deficit than the formal sessions do.",
    };
  }

  if (goal === "fatloss") {
    return {
      sessionsPerWeek: "3 to 4",
      minutesPerSession: "30 to 40 steady, 15 to 20 of work for intervals",
      weeklyMinutesCap: CARDIO_CAP_MINUTES.hypertrophyPriority,
      zones: "Two Zone 2 sessions plus one or two interval sessions",
      modalities,
      placement: "Keep intervals off heavy leg days. " + separation,
      note: "Cycling and rowing are preferred over running while leg volume is high, since running carries the larger interference penalty.",
    };
  }

  if (goal === "contest") {
    return {
      sessionsPerWeek: "4 to 6",
      minutesPerSession: "Start at 20, escalate as needed",
      weeklyMinutesCap: CARDIO_CAP_MINUTES.contestPrep,
      zones: "Predominantly Zone 2, low impact",
      modalities: modalities.filter((m) => m !== "easy_run"),
      placement: "Separate from lifting wherever possible. " + separation,
      note: "Add cardio before cutting calories further once intake approaches the floor. Preserving food preserves training quality. Strength retention is the stop signal.",
    };
  }

  if (goal === "strength") {
    return {
      sessionsPerWeek: "2",
      minutesPerSession: "20",
      weeklyMinutesCap: CARDIO_HEALTH_FLOOR_MINUTES,
      zones: "Zone 2",
      modalities: modalities.filter((m) => m !== "easy_run"),
      placement: "Off days or well separated from heavy lower body work.",
      note: "Enough for cardiovascular health without taxing leg recovery.",
    };
  }

  return {
    sessionsPerWeek: "2",
    minutesPerSession: "20 to 30",
    weeklyMinutesCap: CARDIO_HEALTH_FLOOR_MINUTES,
    zones: "Zone 2, low impact",
    modalities,
    placement: "Non-lifting days. " + separation,
    note: "Capped deliberately. Cardio is not the growth stimulus and every extra session costs recovery that could go to volume.",
  };
}
