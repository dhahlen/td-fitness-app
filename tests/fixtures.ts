import type { Intake } from "../src/types";

/** Untrained 34yo male, desk job, wants to lose fat, 3 days available. */
export const beginnerFatLoss: Intake = {
  client: { name: "Test One", email: "one@test.com", dob: "1992-04-10", sex: "male" },
  screening: { parq: [false,false,false,false,false,false,false], pregnantOrPostpartum: false, eatingDisorderHistory: false, cardiacEvent12mo: false },
  metrics: { heightCm: 180, weightKg: 100, bodyFatPct: 28, bodyFatMethod: "bia" },
  goals: { primary: "fatloss", blockWeeks: 12, priorityMuscles: [] },
  history: { yearsTraining: "under_6mo", consistentMonths12: "under_3", compoundCompetence: 0, currentFrequency: 0, competition: "none" },
  schedule: { daysPerWeek: 3, sessionMinutes: 60, availableDays: ["Mon","Wed","Fri"], equipment: ["commercial"], cardioEquipment: ["treadmill","bike"] },
  nutrition: { pattern: "none", mealsPerDay: 3, cooking: "some", alcoholPerWeek: 4, trackedBefore: false },
  activity: { job: "desk_seated", steps: "5_8k", cardioSessions: 0 },
  recovery: { sleepHours: 7, sleepQuality: 3, stress: 5, caffeineMg: 200, burnoutHistory: false },
  injuries: { present: false, sites: [], underCare: "no" },
  preferences: { checkin: "weekly", leaderboardConsent: "lifts" },
};

/** Experienced lifter, lean, five days, wants size. */
export const advancedMass: Intake = {
  ...beginnerFatLoss,
  client: { ...beginnerFatLoss.client, email: "two@test.com", dob: "1994-01-01" },
  metrics: { heightCm: 178, weightKg: 88, bodyFatPct: 11, bodyFatMethod: "dexa" },
  goals: { primary: "mass", blockWeeks: 16, priorityMuscles: ["shoulders","back"] },
  history: {
    yearsTraining: "over_5yr", consistentMonths12: "10_plus", compoundCompetence: 3,
    currentFrequency: 5, competition: "amateur",
    maxes: { squat: 180, bench: 130, deadlift: 220, ohp: 80 },
  },
  schedule: { ...beginnerFatLoss.schedule, daysPerWeek: 5, availableDays: ["Mon","Tue","Wed","Thu","Fri"] },
  recovery: { sleepHours: 8, sleepQuality: 4, stress: 3, caffeineMg: 300, burnoutHistory: false },
};
