import { LIMITS } from "./standards";
import type { Intake, SafetyFlag, SafetyResult } from "../types";

export const PARQ_QUESTIONS = [
  "Has a doctor ever said you have a heart condition or high blood pressure?",
  "Do you feel pain in your chest at rest, during daily activity, or when you exercise?",
  "Do you lose balance from dizziness, or have you lost consciousness in the last 12 months?",
  "Have you been diagnosed with another chronic medical condition?",
  "Are you currently taking prescribed medication for a chronic condition?",
  "Do you have a bone or joint problem that could be made worse by exercise?",
  "Has a doctor ever said you should only exercise under medical supervision?",
] as const;

export function ageFrom(dob: string, now = new Date()): number {
  const d = new Date(dob);
  let a = now.getUTCFullYear() - d.getUTCFullYear();
  const m = now.getUTCMonth() - d.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < d.getUTCDate())) a--;
  return a;
}

/**
 * Runs before anything else. Nothing downstream may relax what this returns.
 * Blocked means no program. Held means the program renders but the client
 * cannot start it. Suppressed nutrition means no numbers, at all, ever,
 * regardless of what the rest of the intake says.
 */
export function evaluateSafety(intake: Intake, now = new Date()): SafetyResult {
  const flags: SafetyFlag[] = [];
  const age = ageFrom(intake.client.dob, now);

  if (age < LIMITS.minAge) {
    flags.push({
      code: "under_age",
      severity: "block",
      message: `This program is for adults ${LIMITS.minAge} and over.`,
    });
  }

  const parqYes = intake.screening.parq.filter(Boolean).length;
  if (parqYes > 0) {
    flags.push({
      code: "parq_positive",
      severity: "hold",
      message: `${parqYes} positive screening answer${parqYes > 1 ? "s" : ""}. Medical clearance required before starting.`,
    });
  }

  if (intake.screening.cardiacEvent12mo) {
    flags.push({
      code: "cardiac_recent",
      severity: "hold",
      message: "Cardiac event, surgery, or hospitalisation in the last 12 months. Clearance required.",
    });
  }

  if (intake.screening.pregnantOrPostpartum) {
    flags.push({
      code: "pregnancy",
      severity: "hold",
      message: "Programming during pregnancy or the early postpartum period is handled by the coach alongside the client's obstetric provider.",
    });
  }

  if (intake.screening.eatingDisorderHistory) {
    flags.push({
      code: "eating_disorder",
      severity: "hold",
      message: "Nutrition targets are withheld and routed to the coach for a referral conversation.",
    });
  }

  // Goal weight sanity
  const { goalWeightKg, heightCm } = intake.metrics;
  if (goalWeightKg && heightCm) {
    const bmi = goalWeightKg / Math.pow(heightCm / 100, 2);
    if (bmi < LIMITS.minHealthyBmi) {
      flags.push({
        code: "goal_weight_unsafe",
        severity: "notice",
        message: "Goal weight falls below a healthy BMI for this height. A revised target is proposed instead.",
      });
    }
  }

  if (intake.injuries.present && intake.injuries.sites.length > 0) {
    flags.push({
      code: "injury_substitution",
      severity: "notice",
      message: `Exercise substitution applied for: ${intake.injuries.sites.join(", ")}.`,
    });
  }

  return {
    blocked: flags.some((f) => f.severity === "block"),
    clearanceRequired: parqYes > 0 || intake.screening.cardiacEvent12mo,
    manualReview: intake.screening.pregnantOrPostpartum || intake.screening.eatingDisorderHistory,
    suppressNutrition: intake.screening.eatingDisorderHistory || intake.screening.pregnantOrPostpartum,
    flags,
  };
}
