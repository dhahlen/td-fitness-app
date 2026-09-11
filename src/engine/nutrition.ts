import {
  ACTIVITY, ADJUSTMENT, ASSUMED_LBM_FRACTION, BF_BANDS, CARB, CONTEST_PREP_RATE,
  FAT, FAT_LOSS_RATE, FIBRE_G_PER_1000KCAL, KCAL_PER_KG_FAT, LIMITS, PROTEIN,
  SURPLUS, TRUSTED_BF_METHODS, WATER_ML_PER_KG, type Level,
} from "./standards";
import type { Intake, NutritionResult, Phase } from "../types";

export function basalRate(intake: Intake, age: number): number {
  const { weightKg, heightCm, bodyFatPct, bodyFatMethod } = intake.metrics;
  const trusted = bodyFatMethod && (TRUSTED_BF_METHODS as readonly string[]).includes(bodyFatMethod);

  if (bodyFatPct && trusted) {
    const lbm = weightKg * (1 - bodyFatPct / 100);
    return 370 + 21.6 * lbm;            // Katch-McArdle
  }
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return intake.client.sex === "male" ? base + 5 : base - 161;   // Mifflin-St Jeor
}

export function activityFactor(intake: Intake): number {
  return (
    ACTIVITY.job[intake.activity.job] +
    intake.schedule.daysPerWeek * ACTIVITY.perLiftSession +
    intake.activity.cardioSessions * ACTIVITY.perCardioSession +
    ACTIVITY.steps[intake.activity.steps]
  );
}

function bodyFatBand(intake: Intake): keyof typeof FAT_LOSS_RATE {
  const bf = intake.metrics.bodyFatPct;
  if (!bf) return "moderate";
  const b = BF_BANDS[intake.client.sex];
  if (bf > b.moderate) return "high";
  if (bf > b.lean) return "moderate";
  if (bf > b.veryLean) return "lean";
  return "veryLean";
}

function leanBodyMassKg(intake: Intake): number {
  const { weightKg, bodyFatPct } = intake.metrics;
  if (bodyFatPct) return weightKg * (1 - bodyFatPct / 100);
  return weightKg * ASSUMED_LBM_FRACTION[intake.client.sex];
}

/**
 * Protein first, fat second, carbohydrate as the remainder.
 * Floors in LIMITS are enforced here and may not be overridden by input.
 */
export function computeNutrition(intake: Intake, level: Level, age: number): NutritionResult {
  const bmr = basalRate(intake, age);
  const af = activityFactor(intake);
  const tdee = Math.round(bmr * af);
  const kg = intake.metrics.weightKg;

  let phase: Phase = "maintenance";
  let ratePct = 0;
  let cals = tdee;

  const goal = intake.goals.primary;

  if (goal === "fatloss" || goal === "contest") {
    phase = "deficit";
    const band = bodyFatBand(intake);
    ratePct =
      goal === "contest"
        ? band === "veryLean" || band === "lean" ? CONTEST_PREP_RATE.lean : CONTEST_PREP_RATE.normal
        : FAT_LOSS_RATE[band];
    ratePct = Math.min(ratePct, LIMITS.maxWeeklyLossPct);

    const dailyDeficit = (kg * (ratePct / 100) * KCAL_PER_KG_FAT) / 7;
    cals = Math.round(tdee - Math.min(dailyDeficit, tdee * LIMITS.maxDeficitPctOfTdee));
  } else if (goal === "lean") {
    phase = "surplus";
    const novice = level === "beginner" || level === "novice";
    cals = Math.round(tdee * (novice ? SURPLUS.lean_novice : SURPLUS.lean_advanced));
    ratePct = novice ? 0.4 : 0.25;
  } else if (goal === "mass") {
    phase = "surplus";
    const novice = level === "beginner" || level === "novice";
    cals = Math.round(tdee * (novice ? SURPLUS.mass_novice : SURPLUS.mass_advanced));
    ratePct = novice ? 0.5 : 0.3;
  }

  // Floors. Non-negotiable.
  const bmrFloor = Math.round(bmr);
  const absoluteFloor = LIMITS.absoluteCalorieFloor[intake.client.sex];
  const floor = Math.max(bmrFloor, absoluteFloor);
  const floorApplied = cals < floor;
  if (floorApplied) cals = floor;

  // Spec section 9.3 routes the absolute floor to the coach. The BMR floor is
  // common on a large sedentary client and only slows the rate, so it stays a
  // notice.
  const floorType: NutritionResult["floorType"] = !floorApplied
    ? null
    : absoluteFloor >= bmrFloor
      ? "absolute"
      : "bmr";

  // Protein
  const lbm = leanBodyMassKg(intake);
  const novice = level === "beginner" || level === "novice";
  const proteinG =
    phase === "deficit"
      ? novice
        ? Math.round(kg * PROTEIN.deficitNovicePerKgBw)
        : Math.round(lbm * PROTEIN.deficitTrainedPerKgLbm)
      : Math.round(kg * PROTEIN.surplusOrMaintenancePerKgBw);

  // Fat: floor at whichever of the two minimums is higher
  const fatG = Math.round(Math.max(kg * FAT.minPerKgBw, (cals * FAT.minPctOfCalories) / 9));

  // Carbs: remainder
  let carbG = Math.max(0, Math.round((cals - proteinG * 4 - fatG * 9) / 4));
  if (phase === "surplus") carbG = Math.max(carbG, Math.round(kg * CARB.minPerKgBwSurplus));

  return {
    bmr: Math.round(bmr),
    activityFactor: +af.toFixed(3),
    tdee,
    targetCalories: cals,
    phase,
    targetRatePctPerWeek: +ratePct.toFixed(2),
    targetRateKgPerWeek: +((kg * ratePct) / 100).toFixed(2),
    floorApplied,
    floorType,
    calorieFloor: floor,
    protein: {
      grams: proteinG,
      perKgBw: +(proteinG / kg).toFixed(2),
      perMeal: Math.round(proteinG / intake.nutrition.mealsPerDay),
    },
    carbs: { grams: carbG },
    fat: { grams: fatG, pctOfCalories: +(((fatG * 9) / cals) * 100).toFixed(1) },
    fibreG: Math.round((cals / 1000) * FIBRE_G_PER_1000KCAL),
    waterMl: Math.round(kg * WATER_ML_PER_KG),
    reviewEveryDays: ADJUSTMENT.reviewEveryDays,
  };
}

/**
 * Two-weekly adjustment loop. Compare trend weight, not a single morning.
 * Adherence is checked before calories are cut again.
 */
export function adjustCalories(
  current: number,
  actualRateKgPerWeek: number,
  targetRateKgPerWeek: number,
  phase: Phase,
): { calories: number; action: "hold" | "increase" | "decrease" | "check_adherence"; note: string } {
  if (phase === "maintenance" || targetRateKgPerWeek === 0) {
    return { calories: current, action: "hold", note: "Maintenance phase, no change." };
  }
  const ratio = actualRateKgPerWeek / targetRateKgPerWeek;

  if (ratio >= ADJUSTMENT.onTargetRatioLow && ratio <= ADJUSTMENT.onTargetRatioHigh) {
    return { calories: current, action: "hold", note: "On target." };
  }
  if (phase === "deficit" && Math.abs(actualRateKgPerWeek) < ADJUSTMENT.stalledRateKgPerWeek) {
    return {
      calories: current,
      action: "check_adherence",
      note: "Weight flat in a deficit. Check logging accuracy and weekend intake before cutting further.",
    };
  }
  const step = Math.round(current * ADJUSTMENT.stepPctOfCalories);
  const tooSlow = ratio < ADJUSTMENT.onTargetRatioLow;
  const towardGoal = phase === "deficit" ? -1 : 1;
  return {
    calories: current + (tooSlow ? towardGoal * step : -towardGoal * step),
    action: tooSlow ? (phase === "deficit" ? "decrease" : "increase") : phase === "deficit" ? "increase" : "decrease",
    note: tooSlow ? "Behind target rate." : "Ahead of target rate, easing back.",
  };
}
