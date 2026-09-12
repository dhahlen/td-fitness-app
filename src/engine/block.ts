import { weeklySetTargets } from "./session";
import { BLOCK_SHAPE, DELOAD, WEEKLY_VOLUME_RAMP, type Level } from "./standards";
import type {
  BlockPhase, Intake, MuscleGroup, ProgressionResult, SplitResult, VolumeResult, WeekPlan,
} from "../types";

const isBlockPeriodised = (level: Level): boolean => level === "advanced" || level === "elite";

/** Where each week of a cycle falls, for one cycle of the client's model. */
function cycleShape(level: Level, deloadWeek: number): BlockPhase[] {
  if (isBlockPeriodised(level)) {
    return [
      ...Array<BlockPhase>(BLOCK_SHAPE.accumulationWeeks).fill("accumulation"),
      ...Array<BlockPhase>(BLOCK_SHAPE.intensificationWeeks).fill("intensification"),
      ...Array<BlockPhase>(BLOCK_SHAPE.deloadWeeks).fill("deload"),
    ];
  }
  // Linear and double progression deload on the cadence in DELOAD, with the
  // deload landing on that week rather than after it. Spec section 7.
  return [
    ...Array<BlockPhase>(Math.max(1, deloadWeek - 1)).fill("accumulation"),
    "deload",
  ];
}

/**
 * Week by week across the block, with the deload placed.
 *
 * Exercises hold for the mesocycle, so weeks carry set targets and load
 * multipliers rather than a repeated exercise list. Volume climbs about
 * WEEKLY_VOLUME_RAMP sets per muscle per week and is capped by the level's
 * range, which is the ceiling recovery supports. Spec sections 4 and 7.
 */
export function expandBlock(
  intake: Intake,
  level: Level,
  split: SplitResult,
  volume: VolumeResult,
  progression: ProgressionResult,
): WeekPlan[] {
  const week1 = weeklySetTargets(intake, split, volume);
  const shape = cycleShape(level, progression.deloadWeek);
  const weeks: WeekPlan[] = [];

  let accumulated = 0;
  for (let week = 1; week <= intake.goals.blockWeeks; week++) {
    const phase = shape[(week - 1) % shape.length] ?? "accumulation";

    if (phase === "accumulation") {
      const setsPerMuscle = rampedSets(week1, volume, accumulated);
      weeks.push({
        week,
        phase,
        setMultiplier: 1,
        loadMultiplier: 1,
        setsPerMuscle,
        note: accumulated === 0
          ? "Starting volume. Keep the load and add the reps."
          : `Up ${accumulated} sets per muscle on week 1, capped at what your level supports.`,
      });
      accumulated += WEEKLY_VOLUME_RAMP;
      continue;
    }

    if (phase === "intensification") {
      weeks.push({
        week,
        phase,
        setMultiplier: BLOCK_SHAPE.intensificationSetMultiplier,
        loadMultiplier: BLOCK_SHAPE.intensificationLoadMultiplier,
        setsPerMuscle: scaleSets(rampedSets(week1, volume, accumulated), BLOCK_SHAPE.intensificationSetMultiplier),
        note: "Volume comes down and load goes up. Same movements, heavier, fewer sets.",
      });
      continue;
    }

    weeks.push({
      week,
      phase,
      setMultiplier: DELOAD.volumeMultiplier,
      loadMultiplier: DELOAD.loadMultiplier,
      setsPerMuscle: scaleSets(week1, DELOAD.volumeMultiplier),
      note: progression.deloadRule,
    });
    accumulated = 0;
  }

  return weeks;
}

function rampedSets(
  week1: ReadonlyMap<MuscleGroup, number>,
  volume: VolumeResult,
  added: number,
): Partial<Record<MuscleGroup, number>> {
  const out: Partial<Record<MuscleGroup, number>> = {};
  for (const [muscle, sets] of week1) out[muscle] = Math.min(sets + added, volume.perMuscle[muscle][1]);
  return out;
}

function scaleSets(
  sets: ReadonlyMap<MuscleGroup, number> | Partial<Record<MuscleGroup, number>>,
  multiplier: number,
): Partial<Record<MuscleGroup, number>> {
  const entries: Array<[MuscleGroup, number]> =
    sets instanceof Map
      ? [...sets]
      : (Object.entries(sets) as Array<[MuscleGroup, number | undefined]>)
          .filter((e): e is [MuscleGroup, number] => e[1] !== undefined);

  const out: Partial<Record<MuscleGroup, number>> = {};
  for (const [muscle, n] of entries) out[muscle] = Math.max(1, Math.round(n * multiplier));
  return out;
}
