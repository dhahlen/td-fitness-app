import type { Level } from "./engine/standards";

export type Sex = "male" | "female";

export type JobActivity =
  | "desk_seated" | "desk_moving" | "on_feet" | "active_work" | "labour";

export type Goal =
  | "fatloss"
  | "lean"
  | "mass"
  | "recomp"
  | "strength"
  | "health"
  | "contest";

export type Phase = "deficit" | "surplus" | "maintenance";

export type Equipment =
  | "commercial" | "homebar" | "db" | "machines" | "bands" | "cables" | "specialty";

export type CardioEquipment =
  | "treadmill" | "bike" | "rower" | "elliptical" | "stair" | "outdoors";

export type InjurySite =
  | "lower_back" | "neck" | "shoulder" | "elbow" | "wrist" | "hip" | "knee" | "ankle";

export type MuscleGroup =
  | "chest" | "back" | "shoulders" | "quads" | "hamstrings" | "glutes"
  | "biceps" | "triceps" | "calves" | "forearms" | "abs" | "rear_delts";

/* ------------------------------------------------------------------ */
/* Intake                                                              */
/* ------------------------------------------------------------------ */

export interface Intake {
  client: {
    name: string;
    email: string;
    phone?: string;
    dob: string;          // ISO date
    sex: Sex;
    timezone?: string;
  };
  screening: {
    parq: boolean[];      // length 7, index order fixed in PARQ_QUESTIONS
    pregnantOrPostpartum: boolean;
    eatingDisorderHistory: boolean;
    cardiacEvent12mo: boolean;
    notes?: string;
  };
  metrics: {
    heightCm: number;
    weightKg: number;
    goalWeightKg?: number;
    waistCm?: number;
    hipCm?: number;
    bodyFatPct?: number;
    bodyFatMethod?: "dexa" | "bodpod" | "bia" | "calipers" | "visual";
  };
  goals: {
    primary: Goal;
    secondary?: Goal;
    blockWeeks: number;
    eventDate?: string;
    priorityMuscles: MuscleGroup[];   // max 2
  };
  history: {
    yearsTraining: "under_6mo" | "6mo_2yr" | "2_5yr" | "over_5yr";
    consistentMonths12: "under_3" | "3_6" | "6_10" | "10_plus";
    compoundCompetence: 0 | 1 | 2 | 3;
    currentFrequency: number;
    competition: "none" | "amateur" | "pro";
    maxes?: Partial<Record<"squat" | "bench" | "deadlift" | "ohp", number>>; // kg
  };
  schedule: {
    daysPerWeek: 3 | 4 | 5 | 6;
    sessionMinutes: number;
    availableDays: string[];
    equipment: Equipment[];
    cardioEquipment: CardioEquipment[];
  };
  nutrition: {
    pattern: string;
    allergies?: string;
    avoid?: string;
    mealsPerDay: number;
    cooking: "most" | "some" | "rare";
    alcoholPerWeek: number;
    trackedBefore: boolean;
  };
  activity: {
    job: JobActivity;
    steps: "under_5k" | "5_8k" | "8_12k" | "over_12k";
    cardioSessions: number;
  };
  recovery: {
    sleepHours: number;
    sleepQuality: 1 | 2 | 3 | 4 | 5;
    stress: number;            // 1-10
    caffeineMg: number;
    burnoutHistory: boolean;
  };
  injuries: {
    present: boolean;
    sites: InjurySite[];
    detail?: string;
    underCare: "no" | "pt" | "md" | "chiro";
  };
  preferences: {
    enjoy?: string;
    avoidExercises?: string;
    checkin: "weekly" | "biweekly" | "monthly";
    leaderboardConsent: "full" | "lifts" | "none";
  };
}

/* ------------------------------------------------------------------ */
/* Engine output                                                       */
/* ------------------------------------------------------------------ */

export interface SafetyResult {
  blocked: boolean;                 // no program at all
  clearanceRequired: boolean;       // program held pending doctor sign-off
  manualReview: boolean;            // route to coach, do not auto-issue
  suppressNutrition: boolean;       // no calorie or macro numbers
  flags: SafetyFlag[];
}

export interface SafetyFlag {
  code:
    | "under_age" | "parq_positive" | "pregnancy" | "eating_disorder"
    | "cardiac_recent" | "goal_weight_unsafe" | "calorie_floor"
    | "volume_reduced" | "injury_substitution";
  severity: "block" | "hold" | "notice";
  message: string;
}

export interface LevelResult {
  level: Level;
  score: number;
  breakdown: Record<string, number>;
  cappedByDetraining: boolean;
}

export interface VolumeResult {
  large: [number, number];
  small: [number, number];
  priorityBonus: number;
  modifier: number;
  modifiersApplied: string[];
  perMuscle: Record<MuscleGroup, [number, number]>;
}

export interface SplitResult {
  name: string;
  daysPerWeek: number;
  days: Array<{ day: number; label: string; focus: string; notes?: string }>;
  rationale: string;
}

export interface CardioResult {
  sessionsPerWeek: string;
  minutesPerSession: string;
  weeklyMinutesCap: number;
  zones: string;
  modalities: string[];
  placement: string;
  note: string;
}

export interface NutritionResult {
  bmr: number;
  activityFactor: number;
  tdee: number;
  targetCalories: number;
  phase: Phase;
  targetRatePctPerWeek: number;
  targetRateKgPerWeek: number;
  floorApplied: boolean;
  /** Which floor bound. The absolute floor routes to the coach, BMR does not. */
  floorType: "bmr" | "absolute" | null;
  calorieFloor: number;
  protein: { grams: number; perKgBw: number; perMeal: number };
  carbs: { grams: number };
  fat: { grams: number; pctOfCalories: number };
  fibreG: number;
  waterMl: number;
  reviewEveryDays: number;
}

export interface ProgressionResult {
  model: "linear" | "double" | "block";
  description: string;
  incrementLb?: { upper: number; lower: number };
  deloadWeek: number;
  deloadRule: string;
  rirIntroducedWeek: number | null;
}

export type SchemeName =
  | "strength_primary" | "hypertrophy_compound"
  | "hypertrophy_isolation" | "metabolite_finisher";

export interface Program {
  generatedAt: string;
  engineVersion: string;
  safety: SafetyResult;
  level: LevelResult;
  split: SplitResult | null;
  volume: VolumeResult | null;
  cardio: CardioResult | null;
  progression: ProgressionResult | null;
  nutrition: NutritionResult | null;
  scheme: SchemeName | null;
}
