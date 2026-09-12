import { SIX_DAY_GATE, type Level } from "./standards";
import type { Intake, SplitResult } from "../types";

const isAdvanced = (l: Level) => l === "advanced" || l === "elite";
const isBeginner = (l: Level) => l === "beginner" || l === "novice";

/**
 * Split follows from days available, level, and goal. Lookup, not judgement.
 * See docs/program-engine-spec.md section 5.
 */
export function selectSplit(intake: Intake, level: Level): SplitResult {
  const d = intake.schedule.daysPerWeek;

  if (d === 3) {
    if (isBeginner(level)) {
      return {
        name: "Full body",
        daysPerWeek: 3,
        rationale:
          "Full body at three days gives each pattern three exposures a week instead of one. For a beginner the argument is skill acquisition as much as volume.",
        days: [
          { day: 1, label: "Day 1", focus: "Squat pattern, horizontal press, horizontal pull, hinge accessory, core",
            muscles: ["quads", "chest", "back", "hamstrings", "abs"] },
          { day: 2, label: "Day 2", focus: "Hinge pattern, vertical press, vertical pull, single-leg work, core",
            muscles: ["hamstrings", "shoulders", "back", "glutes", "abs"] },
          { day: 3, label: "Day 3", focus: "Squat variation, incline press, row variation, arms, calves",
            muscles: ["quads", "chest", "back", "biceps", "triceps", "calves"] },
        ],
      };
    }
    return {
      name: "Push, pull, legs",
      daysPerWeek: 3,
      rationale:
        "Volume lands at the low end of this level's range. This is a time-constrained configuration, not an optimal one.",
      days: [
        { day: 1, label: "Push", focus: "Chest, shoulders, triceps", muscles: ["chest", "shoulders", "triceps"] },
        { day: 2, label: "Pull", focus: "Back, rear delts, biceps", muscles: ["back", "rear_delts", "biceps"] },
        { day: 3, label: "Legs", focus: "Quads, hamstrings, glutes, calves", muscles: ["quads", "hamstrings", "glutes", "calves"] },
      ],
    };
  }

  if (d === 4) {
    return {
      name: "Upper, lower, upper, lower",
      daysPerWeek: 4,
      rationale: "Twice-weekly frequency per muscle, even volume distribution, easy to auto-regulate.",
      days: [
        { day: 1, label: "Upper A", focus: "Press emphasis", muscles: ["chest", "shoulders", "back", "triceps"] },
        { day: 2, label: "Lower A", focus: "Quad emphasis", muscles: ["quads", "glutes", "calves", "abs"] },
        { day: 3, label: "Upper B", focus: "Pull emphasis", muscles: ["back", "chest", "rear_delts", "biceps"] },
        { day: 4, label: "Lower B", focus: "Posterior chain emphasis", muscles: ["hamstrings", "glutes", "quads", "calves"] },
      ],
    };
  }

  if (d === 5) {
    if (isAdvanced(level)) {
      return {
        name: "Body-part split, isolation on large groups, supersets on small",
        daysPerWeek: 5,
        rationale:
          "Large groups get straight sets with full rest because that is where mechanical tension comes from. Small groups superset at 60 to 90 seconds, which buys back session time on muscles that recover fast.",
        days: [
          { day: 1, label: "Chest", focus: "Chest straight sets", notes: "Triceps supersets to finish",
            muscles: ["chest", "triceps"] },
          { day: 2, label: "Back", focus: "Back straight sets", notes: "Biceps supersets to finish",
            muscles: ["back", "biceps"] },
          { day: 3, label: "Legs, anterior", focus: "Quad-dominant", notes: "Calves",
            muscles: ["quads", "calves"] },
          { day: 4, label: "Shoulders", focus: "Delts, all three heads", notes: "Arm superset cluster",
            muscles: ["shoulders", "rear_delts", "triceps", "biceps"] },
          { day: 5, label: "Legs, posterior", focus: "Hamstrings and glutes", notes: "Weak-point work",
            muscles: ["hamstrings", "glutes", "abs"] },
        ],
      };
    }
    return {
      name: "Push, pull, legs, upper, lower",
      daysPerWeek: 5,
      rationale: "Roughly 2 to 2.5x weekly frequency per muscle without any session exceeding 75 minutes.",
      days: [
        { day: 1, label: "Push", focus: "Chest, shoulders, triceps", muscles: ["chest", "shoulders", "triceps"] },
        { day: 2, label: "Pull", focus: "Back, rear delts, biceps", muscles: ["back", "rear_delts", "biceps"] },
        { day: 3, label: "Legs", focus: "Full lower body", muscles: ["quads", "hamstrings", "glutes", "calves"] },
        { day: 4, label: "Upper", focus: "Weak-point bias", muscles: ["back", "chest", "shoulders", "biceps", "triceps"] },
        { day: 5, label: "Lower", focus: "Hamstring and glute bias", muscles: ["hamstrings", "glutes", "quads", "abs"] },
      ],
    };
  }

  return {
    name: "Push, pull, legs run twice",
    daysPerWeek: 6,
    rationale:
      "Restricted to advanced and elite, and gated on sleep and stress. Six-day programs fail on recovery, not on programming.",
    days: [
      { day: 1, label: "Push, heavy", focus: "Low rep compound emphasis", muscles: ["chest", "shoulders", "triceps"] },
      { day: 2, label: "Pull, heavy", focus: "Low rep compound emphasis", muscles: ["back", "rear_delts", "biceps"] },
      { day: 3, label: "Legs, heavy", focus: "Low rep compound emphasis", muscles: ["quads", "hamstrings", "glutes"] },
      { day: 4, label: "Push, volume", focus: "Higher rep and isolation emphasis", muscles: ["chest", "shoulders", "triceps"] },
      { day: 5, label: "Pull, volume", focus: "Higher rep and isolation emphasis", muscles: ["back", "rear_delts", "biceps"] },
      { day: 6, label: "Legs, volume", focus: "Higher rep and isolation emphasis", muscles: ["quads", "hamstrings", "glutes", "calves", "abs"] },
    ],
  };
}

/** Six-day programs are gated on recovery, not on ambition. */
export function sixDayEligible(intake: Intake, level: Level): boolean {
  return (
    isAdvanced(level) &&
    intake.recovery.sleepHours >= SIX_DAY_GATE.minSleepHours &&
    intake.recovery.stress < SIX_DAY_GATE.maxStress
  );
}
