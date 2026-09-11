import { z } from "zod";

const muscle = z.enum([
  "chest","back","shoulders","quads","hamstrings","glutes",
  "biceps","triceps","calves","forearms","abs","rear_delts",
]);

export const IntakeSchema = z.object({
  client: z.object({
    name: z.string().min(1).max(120),
    email: z.string().email(),
    phone: z.string().max(40).optional(),
    dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    sex: z.enum(["male", "female"]),
    timezone: z.string().optional(),
  }),
  screening: z.object({
    parq: z.array(z.boolean()).length(7),
    pregnantOrPostpartum: z.boolean(),
    eatingDisorderHistory: z.boolean(),
    cardiacEvent12mo: z.boolean(),
    notes: z.string().max(2000).optional(),
  }),
  metrics: z.object({
    heightCm: z.number().min(100).max(250),
    weightKg: z.number().min(30).max(320),
    goalWeightKg: z.number().min(30).max(320).optional(),
    waistCm: z.number().min(40).max(250).optional(),
    hipCm: z.number().min(40).max(250).optional(),
    bodyFatPct: z.number().min(3).max(70).optional(),
    bodyFatMethod: z.enum(["dexa","bodpod","bia","calipers","visual"]).optional(),
  }),
  goals: z.object({
    primary: z.enum(["fatloss","lean","mass","recomp","strength","health","contest"]),
    secondary: z.enum(["fatloss","lean","mass","recomp","strength","health","contest"]).optional(),
    blockWeeks: z.number().int().min(4).max(52),
    eventDate: z.string().optional(),
    priorityMuscles: z.array(muscle).max(2),
  }),
  history: z.object({
    yearsTraining: z.enum(["under_6mo","6mo_2yr","2_5yr","over_5yr"]),
    consistentMonths12: z.enum(["under_3","3_6","6_10","10_plus"]),
    compoundCompetence: z.union([z.literal(0),z.literal(1),z.literal(2),z.literal(3)]),
    currentFrequency: z.number().int().min(0).max(14),
    competition: z.enum(["none","amateur","pro"]),
    maxes: z.object({
      squat: z.number().positive().optional(),
      bench: z.number().positive().optional(),
      deadlift: z.number().positive().optional(),
      ohp: z.number().positive().optional(),
    }).optional(),
  }),
  schedule: z.object({
    daysPerWeek: z.union([z.literal(3),z.literal(4),z.literal(5),z.literal(6)]),
    sessionMinutes: z.number().int().min(20).max(180),
    availableDays: z.array(z.string()).min(1),
    equipment: z.array(z.enum(["commercial","homebar","db","machines","bands","cables","specialty"])),
    cardioEquipment: z.array(z.enum(["treadmill","bike","rower","elliptical","stair","outdoors"])),
  }),
  nutrition: z.object({
    pattern: z.string(),
    allergies: z.string().max(500).optional(),
    avoid: z.string().max(500).optional(),
    mealsPerDay: z.number().int().min(1).max(8),
    cooking: z.enum(["most","some","rare"]),
    alcoholPerWeek: z.number().min(0).max(60),
    trackedBefore: z.boolean(),
  }),
  activity: z.object({
    job: z.enum(["desk_seated","desk_moving","on_feet","active_work","labour"]),
    steps: z.enum(["under_5k","5_8k","8_12k","over_12k"]),
    cardioSessions: z.number().int().min(0).max(14),
  }),
  recovery: z.object({
    sleepHours: z.number().min(2).max(14),
    sleepQuality: z.union([z.literal(1),z.literal(2),z.literal(3),z.literal(4),z.literal(5)]),
    stress: z.number().int().min(1).max(10),
    caffeineMg: z.number().min(0).max(2000),
    burnoutHistory: z.boolean(),
  }),
  injuries: z.object({
    present: z.boolean(),
    sites: z.array(z.enum(["lower_back","neck","shoulder","elbow","wrist","hip","knee","ankle"])),
    detail: z.string().max(2000).optional(),
    underCare: z.enum(["no","pt","md","chiro"]),
  }),
  preferences: z.object({
    enjoy: z.string().max(500).optional(),
    avoidExercises: z.string().max(500).optional(),
    checkin: z.enum(["weekly","biweekly","monthly"]),
    leaderboardConsent: z.enum(["full","lifts","none"]),
  }),
});

export type ValidatedIntake = z.infer<typeof IntakeSchema>;
