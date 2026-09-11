import {
  DETRAINING_MONTHS_THRESHOLD, LARGE_MUSCLES, SMALL_MUSCLES,
  VOLUME, VOLUME_FLOOR, VOLUME_MODIFIERS, type Level,
} from "./standards";
import type { Intake, MuscleGroup, VolumeResult } from "../types";

/** Injury site to the muscle groups whose volume it constrains. */
const INJURY_IMPACT: Record<string, MuscleGroup[]> = {
  lower_back: ["hamstrings", "glutes", "back", "quads"],
  neck: ["shoulders", "back"],
  shoulder: ["chest", "shoulders", "triceps", "rear_delts"],
  elbow: ["biceps", "triceps", "chest"],
  wrist: ["biceps", "triceps", "forearms", "chest"],
  hip: ["glutes", "hamstrings", "quads"],
  knee: ["quads", "hamstrings", "calves"],
  ankle: ["calves", "quads"],
};

const CONSISTENT_MONTHS = { under_3: 1.5, "3_6": 4.5, "6_10": 8, "10_plus": 11 } as const;

export function computeVolume(
  intake: Intake,
  level: Level,
  age: number,
  deepDeficit: boolean,
): VolumeResult {
  const base = VOLUME[level];
  const applied: string[] = [];
  let mod = 1;

  if (intake.recovery.sleepHours < 6) { mod *= VOLUME_MODIFIERS.lowSleep; applied.push("low sleep"); }
  if (intake.recovery.stress >= 8) { mod *= VOLUME_MODIFIERS.highStress; applied.push("high stress"); }
  if (age >= 50) { mod *= VOLUME_MODIFIERS.olderAthlete; applied.push("age 50+"); }
  if (deepDeficit) { mod *= VOLUME_MODIFIERS.deepDeficit; applied.push("deep deficit"); }
  if (CONSISTENT_MONTHS[intake.history.consistentMonths12] < DETRAINING_MONTHS_THRESHOLD) {
    mod *= VOLUME_MODIFIERS.returning;
    applied.push("returning from layoff");
  }

  const scale = (r: readonly [number, number], floor: number): [number, number] => [
    Math.max(floor, Math.round(r[0] * mod)),
    Math.max(floor + 2, Math.round(r[1] * mod)),
  ];

  const large = scale(base.large, VOLUME_FLOOR.large);
  const small = scale(base.small, VOLUME_FLOOR.small);

  // Per-muscle allocation, including priority bonus and injury reduction.
  const injured = new Set<MuscleGroup>();
  if (intake.injuries.present) {
    for (const site of intake.injuries.sites) {
      for (const m of INJURY_IMPACT[site] ?? []) injured.add(m);
    }
  }
  const priority = new Set(intake.goals.priorityMuscles.slice(0, 2));

  const perMuscle = {} as Record<MuscleGroup, [number, number]>;
  const all = [...LARGE_MUSCLES, ...SMALL_MUSCLES] as readonly MuscleGroup[];
  for (const m of all) {
    const isLarge = (LARGE_MUSCLES as readonly string[]).includes(m);
    let [lo, hi] = isLarge ? large : small;
    if (priority.has(m)) hi += base.priorityBonus;
    if (injured.has(m)) {
      lo = Math.round(lo * VOLUME_MODIFIERS.injuredRegion);
      hi = Math.round(hi * VOLUME_MODIFIERS.injuredRegion);
    }
    perMuscle[m] = [lo, hi];
  }

  return {
    large, small,
    priorityBonus: base.priorityBonus,
    modifier: +mod.toFixed(3),
    modifiersApplied: applied,
    perMuscle,
  };
}
