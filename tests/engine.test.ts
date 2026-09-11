import { describe, expect, it } from "vitest";
import { generateProgram } from "../src/engine";
import { classifyLevel } from "../src/engine/level";
import { computeNutrition, adjustCalories } from "../src/engine/nutrition";
import { LIMITS } from "../src/engine/standards";
import type { Intake } from "../src/types";
import { advancedMass, beginnerFatLoss } from "./fixtures";

const NOW = new Date("2026-09-11T00:00:00Z");

describe("level classification", () => {
  it("classifies an untrained client as beginner", () => {
    expect(classifyLevel(beginnerFatLoss).level).toBe("beginner");
  });

  it("classifies an experienced competitive lifter as advanced or elite", () => {
    const r = classifyLevel(advancedMass);
    expect(["advanced", "elite"]).toContain(r.level);
  });

  it("caps a returning lifter at novice regardless of score", () => {
    const returning = { ...advancedMass, history: { ...advancedMass.history, consistentMonths12: "under_3" as const } };
    const r = classifyLevel(returning);
    expect(r.level).toBe("novice");
    expect(r.cappedByDetraining).toBe(true);
  });
});

describe("safety gates", () => {
  it("blocks a minor entirely", () => {
    const minor = { ...beginnerFatLoss, client: { ...beginnerFatLoss.client, dob: "2012-01-01" } };
    const p = generateProgram(minor, NOW);
    expect(p.safety.blocked).toBe(true);
    expect(p.split).toBeNull();
    expect(p.nutrition).toBeNull();
  });

  it("holds the program when any PAR-Q answer is positive", () => {
    const flagged = { ...beginnerFatLoss, screening: { ...beginnerFatLoss.screening, parq: [true,false,false,false,false,false,false] } };
    const p = generateProgram(flagged, NOW);
    expect(p.safety.clearanceRequired).toBe(true);
    expect(p.safety.blocked).toBe(false);
    expect(p.split).not.toBeNull();
  });

  it("suppresses all nutrition output on a positive eating disorder screen", () => {
    const ed = { ...beginnerFatLoss, screening: { ...beginnerFatLoss.screening, eatingDisorderHistory: true } };
    const p = generateProgram(ed, NOW);
    expect(p.nutrition).toBeNull();
    expect(p.safety.manualReview).toBe(true);
    expect(p.split).not.toBeNull();           // training still issued
  });

  it("routes pregnancy to manual review", () => {
    const preg = { ...beginnerFatLoss, client: { ...beginnerFatLoss.client, sex: "female" as const },
      screening: { ...beginnerFatLoss.screening, pregnantOrPostpartum: true } };
    expect(generateProgram(preg, NOW).safety.manualReview).toBe(true);
  });
});

describe("nutrition", () => {
  it("never sets calories below the floor", () => {
    const tiny = { ...beginnerFatLoss, metrics: { ...beginnerFatLoss.metrics, weightKg: 45, heightCm: 150, bodyFatPct: 35 } };
    const n = computeNutrition(tiny, "beginner", 30);
    expect(n.targetCalories).toBeGreaterThanOrEqual(LIMITS.absoluteCalorieFloor.female >= 0 ? n.calorieFloor : 0);
    expect(n.targetCalories).toBeGreaterThanOrEqual(n.bmr);
  });

  it("never exceeds the maximum deficit as a share of TDEE", () => {
    const n = computeNutrition(beginnerFatLoss, "beginner", 34);
    expect(n.tdee - n.targetCalories).toBeLessThanOrEqual(n.tdee * LIMITS.maxDeficitPctOfTdee + 1);
  });

  it("caps the weekly loss rate at 1% of body weight", () => {
    const n = computeNutrition(beginnerFatLoss, "beginner", 34);
    expect(n.targetRatePctPerWeek).toBeLessThanOrEqual(LIMITS.maxWeeklyLossPct);
  });

  it("uses a smaller surplus for advanced lifters than novices", () => {
    const adv = computeNutrition(advancedMass, "advanced", 32);
    const nov = computeNutrition(advancedMass, "novice", 32);
    expect(adv.targetCalories).toBeLessThan(nov.targetCalories);
  });

  it("keeps fat at or above the hormonal floor", () => {
    const n = computeNutrition(beginnerFatLoss, "beginner", 34);
    expect(n.fat.pctOfCalories).toBeGreaterThanOrEqual(19.5);
  });

  it("marks the BMR floor separately from the absolute floor", () => {
    // A large sedentary client is held by BMR, which only slows the rate.
    const big = computeNutrition(beginnerFatLoss, "beginner", 34);
    expect(big.floorApplied).toBe(true);
    expect(big.floorType).toBe("bmr");
    expect(big.targetCalories).toBe(big.bmr);

    // A small client is held by the absolute floor, which routes to the coach.
    const small: Intake = { ...beginnerFatLoss,
      client: { ...beginnerFatLoss.client, sex: "female" },
      metrics: { heightCm: 150, weightKg: 45, bodyFatPct: 35, bodyFatMethod: "bia" },
      activity: { job: "desk_seated", steps: "under_5k", cardioSessions: 0 } };
    const n = computeNutrition(small, "beginner", 34);
    expect(n.floorType).toBe("absolute");
    expect(n.targetCalories).toBe(LIMITS.absoluteCalorieFloor.female);
  });

  it("reports no floor when the target clears both floors", () => {
    const n = computeNutrition(advancedMass, "advanced", 32);
    expect(n.floorApplied).toBe(false);
    expect(n.floorType).toBeNull();
  });

  it("checks adherence before cutting again on a stalled deficit", () => {
    const r = adjustCalories(2000, 0, -0.7, "deficit");
    expect(r.action).toBe("check_adherence");
    expect(r.calories).toBe(2000);
  });
});

describe("split selection", () => {
  it("gives a three-day beginner full body, not a body-part split", () => {
    expect(generateProgram(beginnerFatLoss, NOW).split?.name).toBe("Full body");
  });

  it("gives a five-day advanced lifter the body-part split with supersets", () => {
    expect(generateProgram(advancedMass, NOW).split?.days).toHaveLength(5);
  });

  it("downgrades six days to five when recovery does not support it", () => {
    const six = { ...advancedMass,
      schedule: { ...advancedMass.schedule, daysPerWeek: 6 as const },
      recovery: { ...advancedMass.recovery, sleepHours: 5.5, stress: 9 } };
    const p = generateProgram(six, NOW);
    expect(p.split?.daysPerWeek).toBe(5);
  });
});

describe("volume", () => {
  it("reduces starting volume for poor sleep and high stress", () => {
    const rough = { ...advancedMass, recovery: { ...advancedMass.recovery, sleepHours: 5, stress: 9 } };
    const base = generateProgram(advancedMass, NOW).volume!;
    const cut = generateProgram(rough, NOW).volume!;
    expect(cut.modifier).toBeLessThan(base.modifier);
    expect(cut.large[1]).toBeLessThan(base.large[1]);
  });

  it("never floors below the minimum usable volume", () => {
    const wrecked = { ...beginnerFatLoss, recovery: { ...beginnerFatLoss.recovery, sleepHours: 4, stress: 10 } };
    const v = generateProgram(wrecked, NOW).volume!;
    expect(v.large[0]).toBeGreaterThanOrEqual(6);
  });

  it("adds volume to priority muscles only", () => {
    const v = generateProgram(advancedMass, NOW).volume!;
    expect(v.perMuscle.shoulders[1]).toBeGreaterThan(v.perMuscle.chest[1]);
  });
});

describe("cardio", () => {
  it("caps cardio when hypertrophy is the priority", () => {
    expect(generateProgram(advancedMass, NOW).cardio!.weeklyMinutesCap).toBeLessThanOrEqual(180);
  });

  it("prefers low impact modalities for a knee injury", () => {
    const knee = { ...beginnerFatLoss, injuries: { present: true, sites: ["knee" as const], underCare: "pt" as const } };
    expect(generateProgram(knee, NOW).cardio!.modalities).not.toContain("easy_run");
  });
});

describe("determinism", () => {
  it("produces identical output for identical input", () => {
    const a = generateProgram(advancedMass, NOW);
    const b = generateProgram(advancedMass, NOW);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
