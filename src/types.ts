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
/* Exercise library                                                    */
/* ------------------------------------------------------------------ */

export type MovementPattern =
  | "squat" | "hinge" | "lunge" | "horizontal_push" | "vertical_push"
  | "horizontal_pull" | "vertical_pull" | "carry" | "isolation";

export type LoadingType =
  | "barbell" | "dumbbell" | "machine" | "cable" | "smith"
  | "bodyweight" | "band" | "kettlebell";

/**
 * Physical items, not gym types. The `Equipment` values above are what a
 * client selects; EQUIPMENT_PROFILES in exercises.ts expands each one into
 * the items it gives access to.
 */
export type EquipmentItem =
  | "barbell" | "ez_bar" | "dumbbell" | "kettlebell" | "machine" | "cable"
  | "smith" | "rack" | "bench" | "incline_bench" | "decline_bench"
  | "pullup_bar" | "dip_station" | "bodyweight" | "band" | "box"
  | "sled" | "specialty_bar" | "landmine";

export type SkillLevel = 1 | 2 | 3 | 4 | 5;

/** The four lifts the intake collects a max for, so load can come off a 1RM. */
export type MainLift = "squat" | "bench" | "deadlift" | "ohp";

export interface Exercise {
  id: string;
  name: string;
  aliases?: string[];
  pattern: MovementPattern;
  primeMovers: MuscleGroup[];
  secondaryMovers?: MuscleGroup[];
  /** Every item is required to perform the movement. */
  equipment: EquipmentItem[];
  loading: LoadingType;
  skill: SkillLevel;
  setupComplexity: 1 | 2 | 3;
  unilateral?: boolean;
  /** Injury sites that rule the movement out rather than just loading it light. */
  contraindications?: InjurySite[];
  /** Ordered preferred replacements. Falls back to a structural match. */
  substitutions?: string[];
  /** Pairs well in a superset, used on the advanced five-day split. */
  supersetWith?: string[];
  mainLift?: MainLift;
  cues?: string[];
}

/* ------------------------------------------------------------------ */
/* Prescribed sessions                                                 */
/* ------------------------------------------------------------------ */

export type LoadKind = "percent_1rm" | "load_finding" | "bodyweight";

export interface LoadPrescription {
  kind: LoadKind;
  /** Working weight. Present only when a reported max made a real number possible. */
  lb?: number;
  lbRange?: [number, number];
  pctOf1rm?: [number, number];
  estimated1rmLb?: number;
  instruction: string;
}

export interface Alternative {
  id: string;
  name: string;
  reason: "equipment" | "injury" | "preference";
}

export interface PrescribedExercise {
  exerciseId: string;
  name: string;
  /** Same muscle, different equipment. The client picks whichever is free. */
  alternatives: Alternative[];
  muscle: MuscleGroup;
  sets: number;
  reps: [number, number];
  rir: [number, number] | null;
  restSec: [number, number];
  scheme: SchemeName;
  load: LoadPrescription;
  supersetWith?: string;
  note?: string;
}

export interface SessionPlan {
  day: number;
  label: string;
  focus: string;
  muscles: MuscleGroup[];
  exercises: PrescribedExercise[];
  estimatedMinutes: number;
  notes: string[];
}

export type BlockPhase = "accumulation" | "intensification" | "deload";

export interface WeekPlan {
  week: number;
  phase: BlockPhase;
  /** Applied to week 1 set counts. */
  setMultiplier: number;
  /** Applied to week 1 loads. */
  loadMultiplier: number;
  setsPerMuscle: Partial<Record<MuscleGroup, number>>;
  note: string;
}

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
    /**
     * When those maxes were last tested. A number goes stale, and a stale one
     * is worse than a blank field because it loads every session off it. Absent
     * means unknown, which is treated as stale.
     */
    maxesTestedWithin?: "3_weeks" | "3_months" | "over_3_months";
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
  days: Array<{
    day: number;
    label: string;
    focus: string;
    /** Muscles this day trains, in the order they should be worked. */
    muscles: MuscleGroup[];
    notes?: string;
  }>;
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
  /** Week 1 in full. Exercises hold for the mesocycle, sets and load ramp. */
  sessions: SessionPlan[] | null;
  block: WeekPlan[] | null;
}
