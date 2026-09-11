/**
 * Every tunable number in the engine lives here.
 *
 * Change values in this file to adjust programming philosophy without
 * touching logic. Nothing else in src/engine should contain a magic number.
 * If you find one, move it here.
 */

export const LEVELS = ["beginner", "novice", "intermediate", "advanced", "elite"] as const;
export type Level = (typeof LEVELS)[number];

/* ------------------------------------------------------------------ */
/* Level classification                                                */
/* ------------------------------------------------------------------ */

/** Upper bound of the score band for each level. */
export const LEVEL_THRESHOLDS: Array<[Level, number]> = [
  ["beginner", 5],
  ["novice", 10],
  ["intermediate", 16],
  ["advanced", 21],
  ["elite", Infinity],
];

export const YEARS_POINTS = { under_6mo: 0, "6mo_2yr": 2, "2_5yr": 4, over_5yr: 6 } as const;
export const CONSISTENCY_POINTS = { under_3: 0, "3_6": 1, "6_10": 2, "10_plus": 3 } as const;
export const COMPETITION_POINTS = { none: 0, amateur: 2, pro: 4 } as const;

/**
 * Relative strength standards as multiples of body weight.
 *
 * TUNE THESE FIRST. They should reflect the actual client base, not a
 * generic internet chart. Format: [novice, intermediate, advanced].
 * A lift at or above `advanced` scores 6, `intermediate` 4, `novice` 2,
 * below that 0. Final points are the mean across reported lifts.
 */
export const STRENGTH_STANDARDS = {
  male: {
    squat: [1.0, 1.5, 2.0],
    bench: [0.75, 1.15, 1.5],
    deadlift: [1.25, 1.85, 2.25],
    ohp: [0.5, 0.7, 0.9],
  },
  female: {
    squat: [0.75, 1.15, 1.5],
    bench: [0.5, 0.75, 1.0],
    deadlift: [1.0, 1.4, 1.8],
    ohp: [0.35, 0.5, 0.65],
  },
} as const;

/**
 * Detraining cap. Fewer than this many consistent months in the last 12
 * caps the client at `novice` for the first mesocycle regardless of score.
 */
export const DETRAINING_MONTHS_THRESHOLD = 6;

/* ------------------------------------------------------------------ */
/* Volume: weekly hard sets per muscle group                           */
/* ------------------------------------------------------------------ */

export const VOLUME: Record<
  Level,
  { large: [number, number]; small: [number, number]; priorityBonus: number }
> = {
  beginner: { large: [6, 10], small: [4, 8], priorityBonus: 2 },
  novice: { large: [10, 14], small: [8, 12], priorityBonus: 3 },
  intermediate: { large: [12, 18], small: [10, 16], priorityBonus: 4 },
  advanced: { large: [14, 22], small: [12, 18], priorityBonus: 4 },
  elite: { large: [16, 24], small: [12, 20], priorityBonus: 4 },
};

/** Multiplicative, applied in order, then floored. */
export const VOLUME_MODIFIERS = {
  lowSleep: 0.85,
  highStress: 0.85,
  olderAthlete: 0.9,
  deepDeficit: 0.9,
  injuredRegion: 0.7,
  returning: 0.75,
} as const;

export const VOLUME_FLOOR = { large: 6, small: 4 } as const;

/** Sets added per muscle per week across an accumulation block. */
export const WEEKLY_VOLUME_RAMP = 2;

export const LARGE_MUSCLES = [
  "quads", "hamstrings", "glutes", "chest", "back", "shoulders",
] as const;
export const SMALL_MUSCLES = [
  "biceps", "triceps", "calves", "forearms", "abs", "rear_delts",
] as const;

/* ------------------------------------------------------------------ */
/* Nutrition                                                           */
/* ------------------------------------------------------------------ */

export const ACTIVITY = {
  job: { desk_seated: 1.2, desk_moving: 1.3, on_feet: 1.45, active_work: 1.6, labour: 1.75 },
  perLiftSession: 0.025,
  perCardioSession: 0.02,
  steps: { under_5k: 0, "5_8k": 0.02, "8_12k": 0.06, over_12k: 0.1 },
} as const;

/** Weekly rate of loss as a percent of body weight, keyed by body fat band. */
export const FAT_LOSS_RATE = {
  high: 0.9,
  moderate: 0.7,
  lean: 0.55,
  veryLean: 0.4,
} as const;

export const CONTEST_PREP_RATE = { lean: 0.35, normal: 0.6 } as const;

/** Body fat band cut points, percent. */
export const BF_BANDS = {
  male: { veryLean: 12, lean: 20, moderate: 30 },
  female: { veryLean: 20, lean: 28, moderate: 38 },
} as const;

/** Surplus as a multiple of TDEE. */
export const SURPLUS = {
  lean_novice: 1.12,
  lean_advanced: 1.08,
  mass_novice: 1.18,
  mass_advanced: 1.12,
} as const;

/** Hard safety limits. Enforced in code, never overridable by input. */
export const LIMITS = {
  maxDeficitPctOfTdee: 0.25,
  absoluteCalorieFloor: { male: 1500, female: 1200 },
  minHealthyBmi: 18.5,
  maxWeeklyLossPct: 1.0,
  minAge: 18,
} as const;

export const PROTEIN = {
  surplusOrMaintenancePerKgBw: 1.9,
  deficitNovicePerKgBw: 2.0,
  deficitTrainedPerKgLbm: 2.6,
  perMealMinPerKgBw: 0.4,
  perMealMaxPerKgBw: 0.55,
} as const;

export const FAT = {
  minPerKgBw: 0.7,
  minPctOfCalories: 0.2,
  maxPerKgBw: 1.5,
} as const;

export const CARB = { minPerKgBwSurplus: 3.0 } as const;

export const FIBRE_G_PER_1000KCAL = 14;
export const WATER_ML_PER_KG = 35;

/** Used when body fat percentage is unknown. */
export const ASSUMED_LBM_FRACTION = { male: 0.82, female: 0.74 } as const;

/** Body fat methods accurate enough to drive Katch-McArdle. */
export const TRUSTED_BF_METHODS = ["dexa", "bodpod"] as const;

/* ------------------------------------------------------------------ */
/* Cardio                                                              */
/* ------------------------------------------------------------------ */

export const CARDIO_CAP_MINUTES = {
  hypertrophyPriority: 180,
  contestPrep: 300,
} as const;

export const CARDIO_HEALTH_FLOOR_MINUTES = 150;

/** Preferred while leg volume is high. Running interferes more than these. */
export const LOW_IMPACT_MODALITIES = ["bike", "rower", "elliptical", "incline_walk"] as const;

/** Minimum hours between a lifting and a cardio session on the same day. */
export const CONCURRENT_SEPARATION_HOURS = 6;

/* ------------------------------------------------------------------ */
/* Progression and periodisation                                       */
/* ------------------------------------------------------------------ */

export const DELOAD = {
  everyNWeeks: { beginner: 6, novice: 6, intermediate: 5, advanced: 5, elite: 5 },
  volumeMultiplier: 0.5,
  loadMultiplier: 0.875,
} as const;

export const LINEAR_INCREMENT_LB = { upper: 2.5, lower: 5 } as const;
export const FAILED_SESSION_RESET_PCT = 0.1;

/** Beginners train without RIR targets before this week number. */
export const RIR_INTRODUCTION_WEEK = 5;

/* ------------------------------------------------------------------ */
/* Rep and rest schemes                                                */
/* ------------------------------------------------------------------ */

export const SCHEMES = {
  strength_primary: { pct1rm: [0.8, 0.92], reps: [1, 5], rir: [1, 3], restSec: [180, 300] },
  hypertrophy_compound: { pct1rm: [0.7, 0.8], reps: [6, 12], rir: [1, 3], restSec: [120, 180] },
  hypertrophy_isolation: { pct1rm: [0.6, 0.75], reps: [10, 15], rir: [0, 2], restSec: [60, 90] },
  metabolite_finisher: { pct1rm: [0.4, 0.6], reps: [15, 25], rir: [0, 1], restSec: [45, 60] },
} as const;
