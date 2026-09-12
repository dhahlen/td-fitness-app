import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { generateProgram } from "../src/engine";
import { EXERCISES, availableEquipment, canPerform, exerciseById, familyOf, isContraindicated } from "../src/engine/exercises";
import { distribute, estimateMinutes } from "../src/engine/session";
import { roundLoad } from "../src/engine/load";
import { EXERCISE_ALLOCATION, SCHEMES } from "../src/engine/standards";
import type { Intake, PrescribedExercise } from "../src/types";
import { advancedMass, beginnerFatLoss } from "./fixtures";

const NOW = new Date("2026-09-11T00:00:00Z");
const allExercises = (intake: Intake): PrescribedExercise[] =>
  (generateProgram(intake, NOW).sessions ?? []).flatMap((s) => s.exercises);

describe("exercise library", () => {
  it("has no duplicate ids", () => {
    const ids = EXERCISES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("only points substitutions at exercises that exist", () => {
    for (const e of EXERCISES) {
      for (const id of e.substitutions ?? []) {
        expect(exerciseById(id), `${e.id} substitutes to unknown ${id}`).toBeDefined();
      }
    }
  });

  it("never substitutes to a movement that trains something else", () => {
    for (const e of EXERCISES) {
      for (const id of e.substitutions ?? []) {
        const sub = exerciseById(id);
        const shared = sub?.primeMovers.some((m) => e.primeMovers.includes(m));
        expect(shared, `${e.id} substitutes to ${id}, which trains a different muscle`).toBe(true);
      }
    }
  });

  it("covers every muscle group with a commercial gym", () => {
    const available = availableEquipment(["commercial"]);
    const muscles = ["chest","back","shoulders","quads","hamstrings","glutes","biceps","triceps","calves","abs","rear_delts","forearms"] as const;
    for (const m of muscles) {
      const usable = EXERCISES.filter((e) => e.primeMovers.includes(m) && canPerform(e, available));
      expect(usable.length, `no ${m} exercise in a commercial gym`).toBeGreaterThan(0);
    }
  });

  it("covers the large muscle groups with dumbbells alone", () => {
    const available = availableEquipment(["db"]);
    for (const m of ["chest", "back", "shoulders", "quads", "hamstrings", "glutes"] as const) {
      const usable = EXERCISES.filter((e) => e.primeMovers.includes(m) && canPerform(e, available));
      expect(usable.length, `no ${m} exercise with dumbbells`).toBeGreaterThan(0);
    }
  });
});

describe("session generation", () => {
  it("prescribes named exercises with sets, reps and a load for every day", () => {
    const p = generateProgram(beginnerFatLoss, NOW);
    expect(p.sessions).toHaveLength(p.split!.daysPerWeek);
    for (const session of p.sessions!) {
      expect(session.exercises.length).toBeGreaterThan(0);
      for (const e of session.exercises) {
        expect(e.name).not.toBe("");
        expect(e.sets).toBeGreaterThanOrEqual(EXERCISE_ALLOCATION.minSetsPerExercise);
        expect(e.reps[0]).toBeLessThanOrEqual(e.reps[1]);
        expect(e.load.instruction).not.toBe("");
      }
    }
  });

  it("opens a muscle with a compound before reaching for isolation", () => {
    const p = generateProgram(advancedMass, NOW);
    const chestDay = p.sessions!.find((s) => s.muscles[0] === "chest");
    const first = chestDay?.exercises.find((e) => e.muscle === "chest");
    expect(exerciseById(first!.exerciseId)?.pattern).not.toBe("isolation");
  });

  it("does not prescribe the same movement twice in one session", () => {
    for (const intake of [beginnerFatLoss, advancedMass]) {
      for (const session of generateProgram(intake, NOW).sessions!) {
        const families = session.exercises
          .map((e) => exerciseById(e.exerciseId))
          .filter((e) => e !== undefined)
          .map((e) => `${familyOf(e)}:${e.primeMovers[0]}`);
        expect(new Set(families).size, `${session.label} repeats a movement`).toBe(families.length);
      }
    }
  });

  it("offers an alternative for the busy-station case", () => {
    const withAlternatives = allExercises(beginnerFatLoss).filter((e) => e.alternatives.length > 0);
    expect(withAlternatives.length).toBeGreaterThan(0);
    for (const e of withAlternatives) {
      for (const alt of e.alternatives) expect(alt.id).not.toBe(e.exerciseId);
    }
  });
});

describe("equipment and injuries", () => {
  const dumbbellsOnly: Intake = {
    ...beginnerFatLoss,
    schedule: { ...beginnerFatLoss.schedule, equipment: ["db"], daysPerWeek: 4 },
  };

  it("never prescribes equipment the client does not have", () => {
    const available = availableEquipment(dumbbellsOnly.schedule.equipment);
    for (const e of allExercises(dumbbellsOnly)) {
      const ex = exerciseById(e.exerciseId)!;
      expect(canPerform(ex, available), `${ex.name} needs ${ex.equipment.join(", ")}`).toBe(true);
      for (const alt of e.alternatives) {
        expect(canPerform(exerciseById(alt.id)!, available), `alternative ${alt.name} is not available`).toBe(true);
      }
    }
  });

  it("still fills a four-day split with dumbbells alone", () => {
    for (const session of generateProgram(dumbbellsOnly, NOW).sessions!) {
      expect(session.exercises.length).toBeGreaterThan(0);
    }
  });

  it("prescribes nothing contraindicated by a flagged injury", () => {
    const hurt: Intake = {
      ...advancedMass,
      injuries: { present: true, sites: ["shoulder", "knee", "lower_back"], underCare: "pt" },
    };
    for (const e of allExercises(hurt)) {
      const ex = exerciseById(e.exerciseId)!;
      expect(isContraindicated(ex, ["shoulder", "knee", "lower_back"]), `${ex.name} is contraindicated`).toBe(false);
      for (const alt of e.alternatives) {
        expect(isContraindicated(exerciseById(alt.id)!, ["shoulder", "knee", "lower_back"])).toBe(false);
      }
    }
  });

  it("keeps a beginner off the movements they have not been taught", () => {
    for (const e of allExercises(beginnerFatLoss)) {
      expect(exerciseById(e.exerciseId)!.skill).toBeLessThanOrEqual(2);
    }
  });

  it("gives the barbell lifts to a beginner who is coached and confident", () => {
    const coached: Intake = {
      ...beginnerFatLoss,
      history: { ...beginnerFatLoss.history, compoundCompetence: 3 },
    };
    const skills = allExercises(coached).map((e) => exerciseById(e.exerciseId)!.skill);
    expect(Math.max(...skills)).toBeGreaterThan(2);
  });
});

describe("session length", () => {
  it("fits the time the client says they have", () => {
    const rushed: Intake = { ...beginnerFatLoss, schedule: { ...beginnerFatLoss.schedule, sessionMinutes: 30 } };
    for (const session of generateProgram(rushed, NOW).sessions!) {
      expect(session.estimatedMinutes).toBeLessThanOrEqual(30);
    }
  });

  it("says so when a short session costs volume", () => {
    const rushed: Intake = { ...advancedMass, schedule: { ...advancedMass.schedule, sessionMinutes: 30 } };
    const p = generateProgram(rushed, NOW);
    expect(p.safety.flags.some((f) => f.code === "volume_reduced" && f.message.includes("30 minute"))).toBe(true);
  });

  it("estimates longer for a session with more sets", () => {
    const one = [{ sets: 3, scheme: "hypertrophy_compound" }] as PrescribedExercise[];
    const two = [{ sets: 6, scheme: "hypertrophy_compound" }] as PrescribedExercise[];
    expect(estimateMinutes(two)).toBeGreaterThan(estimateMinutes(one));
  });
});

describe("load prescription", () => {
  it("gives a real weight off a reported max", () => {
    const bench = allExercises(advancedMass).find((e) => e.exerciseId === "bb_bench");
    expect(bench?.load.kind).toBe("percent_1rm");
    expect(bench?.load.lb).toBeGreaterThan(0);
    expect(bench!.load.lb!).toBeLessThan(bench!.load.estimated1rmLb!);
  });

  it("prescribes a protocol rather than a guess when no max was given", () => {
    for (const e of allExercises(beginnerFatLoss)) {
      expect(e.load.kind).not.toBe("percent_1rm");
      expect(e.load.lb).toBeUndefined();
    }
  });

  it("rounds to a jump the gym can make", () => {
    expect(roundLoad(183, "barbell")).toBe(185);
    expect(roundLoad(183, "dumbbell")).toBe(182.5);
  });

  it("stays inside the scheme's percentage band", () => {
    const squat = allExercises(advancedMass).find((e) => e.exerciseId === "bb_back_squat");
    const [lo, hi] = SCHEMES[squat!.scheme].pct1rm;
    expect(squat!.load.pctOf1rm).toEqual([lo, hi]);
  });
});

describe("block expansion", () => {
  it("covers every week of the block and places a deload", () => {
    const p = generateProgram(beginnerFatLoss, NOW);
    expect(p.block).toHaveLength(beginnerFatLoss.goals.blockWeeks);
    expect(p.block!.some((w) => w.phase === "deload")).toBe(true);
    expect(p.block![0]?.week).toBe(1);
  });

  it("ramps volume across the accumulation weeks", () => {
    const p = generateProgram(advancedMass, NOW);
    const acc = p.block!.filter((w) => w.phase === "accumulation");
    expect((acc[1]?.setsPerMuscle.chest ?? 0)).toBeGreaterThan(acc[0]?.setsPerMuscle.chest ?? 0);
  });

  it("never rams volume past the level's ceiling", () => {
    const p = generateProgram(advancedMass, NOW);
    const cap = p.volume!.perMuscle.chest[1];
    for (const w of p.block!) expect(w.setsPerMuscle.chest ?? 0).toBeLessThanOrEqual(cap);
  });

  it("cuts volume and load on the deload week", () => {
    const p = generateProgram(beginnerFatLoss, NOW);
    const deload = p.block!.find((w) => w.phase === "deload")!;
    expect(deload.setMultiplier).toBeLessThan(1);
    expect(deload.loadMultiplier).toBeLessThan(1);
  });

  it("gives advanced lifters an intensification phase", () => {
    expect(generateProgram(advancedMass, NOW).block!.some((w) => w.phase === "intensification")).toBe(true);
  });
});

describe("safety still wins", () => {
  it("issues no sessions for a blocked intake", () => {
    const minor: Intake = { ...beginnerFatLoss, client: { ...beginnerFatLoss.client, dob: "2012-01-01" } };
    const p = generateProgram(minor, NOW);
    expect(p.sessions).toBeNull();
    expect(p.block).toBeNull();
  });

  it("still issues training when nutrition is suppressed", () => {
    const ed: Intake = {
      ...beginnerFatLoss,
      screening: { ...beginnerFatLoss.screening, eatingDisorderHistory: true },
    };
    const p = generateProgram(ed, NOW);
    expect(p.nutrition).toBeNull();
    expect(p.sessions!.length).toBeGreaterThan(0);
  });
});

describe("shared volume", () => {
  it("counts a compound toward every prime mover it trains", () => {
    // A Romanian deadlift is glute volume as much as hamstring volume, so a
    // posterior day that opens with hinges owes fewer dedicated glute sets.
    const posterior = generateProgram(advancedMass, NOW).sessions!
      .find((s) => s.muscles.includes("hamstrings") && s.muscles.includes("glutes"));
    expect(posterior).toBeDefined();

    const hinges = posterior!.exercises.filter(
      (e) => exerciseById(e.exerciseId)!.primeMovers.includes("glutes"),
    );
    const gluteSets = hinges.reduce((n, e) => n + e.sets, 0);
    const dedicated = posterior!.exercises.filter((e) => e.muscle === "glutes").reduce((n, e) => n + e.sets, 0);

    expect(gluteSets).toBeGreaterThan(dedicated);
  });

  it("does not spend a muscle's budget twice over", () => {
    const p = generateProgram(advancedMass, NOW);
    for (const session of p.sessions!) {
      for (const muscle of session.muscles) {
        const sets = session.exercises
          .filter((e) => exerciseById(e.exerciseId)!.primeMovers.includes(muscle))
          .reduce((n, e) => n + e.sets, 0);
        expect(sets, `${session.label} overruns ${muscle}`).toBeLessThanOrEqual(p.volume!.perMuscle[muscle][1]);
      }
    }
  });
});

describe("the D1 seed", () => {
  it("matches the library module", () => {
    const sql = readFileSync(new URL("../schema/0002_exercises.sql", import.meta.url), "utf8");
    const rows = sql.split("\n").filter((l) => l.startsWith("INSERT INTO exercises ("));
    expect(rows, "run npm run seed:exercises").toHaveLength(EXERCISES.length);
    for (const e of EXERCISES) {
      expect(sql.includes(`'${e.id}'`), `${e.id} is missing from the seed`).toBe(true);
    }
  });
});

describe("helpers", () => {
  it("distributes sets as evenly as it can, biggest first", () => {
    expect(distribute(9, 3)).toEqual([3, 3, 3]);
    expect(distribute(8, 3)).toEqual([3, 3, 2]);
    expect(distribute(5, 2)).toEqual([3, 2]);
    expect(distribute(4, 0)).toEqual([]);
  });
});

describe("determinism", () => {
  it("produces identical sessions for identical input", () => {
    const a = generateProgram(advancedMass, NOW);
    const b = generateProgram(advancedMass, NOW);
    expect(JSON.stringify(a.sessions)).toBe(JSON.stringify(b.sessions));
    expect(JSON.stringify(a.block)).toBe(JSON.stringify(b.block));
  });
});
