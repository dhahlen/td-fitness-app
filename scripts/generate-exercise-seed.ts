/**
 * Writes schema/0002_exercises.sql from src/engine/exercises.ts.
 *
 * The library is TypeScript because the engine is pure and may not read a
 * database. D1 still needs the rows: set_logs references exercises(id), and
 * the coach dashboard queries them. So the module is the source of truth and
 * this regenerates the migration from it.
 *
 * Run: npm run seed:exercises
 */
import { writeFileSync } from "node:fs";
import { EXERCISES, familyOf } from "../src/engine/exercises";

const q = (v: string | null): string => (v === null ? "NULL" : `'${v.replace(/'/g, "''")}'`);
const json = (v: unknown[] | undefined): string => (v && v.length ? q(JSON.stringify(v)) : "NULL");

const lines: string[] = [
  "-- Exercise library.",
  "-- Generated from src/engine/exercises.ts by scripts/generate-exercise-seed.ts.",
  "-- Do not edit by hand. Change the module and regenerate.",
  "",
  "ALTER TABLE exercises ADD COLUMN family TEXT;",
  "ALTER TABLE exercises ADD COLUMN main_lift TEXT;",
  "",
  "DELETE FROM exercise_supersets;",
  "DELETE FROM exercise_substitutions;",
  "DELETE FROM exercises;",
  "",
];

for (const e of EXERCISES) {
  lines.push(
    "INSERT INTO exercises (id,name,aliases,movement_pattern,prime_movers,secondary_movers," +
      "equipment,loading_type,skill_level,setup_complexity,unilateral,contraindications," +
      "coaching_cues,family,main_lift) VALUES (" +
      [
        q(e.id), q(e.name), json(e.aliases), q(e.pattern), json(e.primeMovers),
        json(e.secondaryMovers), json(e.equipment), q(e.loading), String(e.skill),
        String(e.setupComplexity), e.unilateral ? "1" : "0", json(e.contraindications),
        json(e.cues), q(familyOf(e)), e.mainLift ? q(e.mainLift) : "NULL",
      ].join(",") +
      ");",
  );
}

lines.push("");
for (const e of EXERCISES) {
  (e.substitutions ?? []).forEach((sub, i) => {
    lines.push(
      `INSERT INTO exercise_substitutions (exercise_id,substitute_id,rank,reason) VALUES (${q(e.id)},${q(sub)},${i + 1},'equipment');`,
    );
  });
}

lines.push("");
for (const e of EXERCISES) {
  for (const pair of e.supersetWith ?? []) {
    lines.push(`INSERT INTO exercise_supersets (exercise_id,pair_id) VALUES (${q(e.id)},${q(pair)});`);
  }
}

writeFileSync(new URL("../schema/0002_exercises.sql", import.meta.url), lines.join("\n") + "\n");
console.log(`Wrote schema/0002_exercises.sql with ${EXERCISES.length} exercises.`);
