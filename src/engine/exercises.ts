/**
 * The exercise library.
 *
 * The substitution graph is what makes equipment and injury handling work, so
 * entries carry real relationships rather than a free-text note. See
 * docs/program-engine-spec.md section 10.
 *
 * Curated `substitutions` are the preferred replacements in order. When none
 * of them fit the client's equipment, selection.ts falls back to a structural
 * match on pattern and prime mover, so every movement has somewhere to go.
 */
import type {
  Equipment, EquipmentItem, Exercise, InjurySite, LoadingType,
  MovementPattern, MuscleGroup, SkillLevel,
} from "../types";

/** What each access option a client selects gives them. */
export const EQUIPMENT_PROFILES: Record<Equipment, readonly EquipmentItem[]> = {
  commercial: [
    "barbell", "ez_bar", "dumbbell", "kettlebell", "machine", "cable", "smith",
    "rack", "bench", "incline_bench", "decline_bench", "pullup_bar",
    "dip_station", "bodyweight", "box", "landmine",
  ],
  homebar: ["barbell", "rack", "bench", "incline_bench", "bodyweight", "box"],
  db: ["dumbbell", "bench", "incline_bench", "bodyweight"],
  machines: ["machine", "smith", "bodyweight"],
  bands: ["band", "bodyweight", "box"],
  cables: ["cable", "bodyweight"],
  specialty: ["specialty_bar", "sled", "landmine", "bodyweight"],
};

type Extra = Partial<Omit<Exercise, "id" | "name" | "pattern" | "primeMovers" | "equipment" | "loading" | "skill">>;

const ex = (
  id: string,
  name: string,
  pattern: MovementPattern,
  primeMovers: MuscleGroup[],
  equipment: EquipmentItem[],
  loading: LoadingType,
  skill: SkillLevel,
  extra: Extra = {},
): Exercise => ({ id, name, pattern, primeMovers, equipment, loading, skill, setupComplexity: 1, ...extra });

export const EXERCISES: readonly Exercise[] = [
  /* ---------------- chest ---------------- */
  ex("bb_bench", "Flat barbell bench press", "horizontal_push", ["chest"], ["barbell", "bench", "rack"], "barbell", 3, {
    secondaryMovers: ["triceps", "shoulders"], mainLift: "bench", contraindications: ["shoulder"], setupComplexity: 2,
    substitutions: ["db_bench", "machine_chest_press", "smith_bench", "cable_press_flat"],
    cues: ["Shoulder blades pulled back and down", "Bar touches the lower chest", "Drive the feet into the floor"],
  }),
  ex("db_bench", "Flat dumbbell bench press", "horizontal_push", ["chest"], ["dumbbell", "bench"], "dumbbell", 2, {
    secondaryMovers: ["triceps", "shoulders"],
    substitutions: ["bb_bench", "machine_chest_press", "cable_press_flat", "pushup"],
  }),
  ex("machine_chest_press", "Chest press machine", "horizontal_push", ["chest"], ["machine"], "machine", 1, {
    secondaryMovers: ["triceps", "shoulders"],
    substitutions: ["db_bench", "cable_press_flat", "smith_bench", "pushup"],
  }),
  ex("smith_bench", "Smith machine bench press", "horizontal_push", ["chest"], ["smith", "bench"], "smith", 2, {
    secondaryMovers: ["triceps", "shoulders"],
    substitutions: ["machine_chest_press", "db_bench", "bb_bench"],
  }),
  ex("cable_press_flat", "Flat cable chest press", "horizontal_push", ["chest"], ["cable"], "cable", 2, {
    secondaryMovers: ["triceps", "shoulders"],
    substitutions: ["machine_chest_press", "db_bench", "pushup"],
  }),
  ex("bb_incline", "Incline barbell bench press", "horizontal_push", ["chest"], ["barbell", "incline_bench", "rack"], "barbell", 3, {
    secondaryMovers: ["shoulders", "triceps"], contraindications: ["shoulder"], setupComplexity: 2,
    substitutions: ["db_incline", "machine_incline_press", "cable_fly_low", "smith_bench"],
  }),
  ex("db_incline", "Incline dumbbell press", "horizontal_push", ["chest"], ["dumbbell", "incline_bench"], "dumbbell", 2, {
    secondaryMovers: ["shoulders", "triceps"],
    substitutions: ["bb_incline", "machine_incline_press", "cable_fly_low", "pushup"],
  }),
  ex("machine_incline_press", "Incline press machine", "horizontal_push", ["chest"], ["machine"], "machine", 1, {
    secondaryMovers: ["shoulders", "triceps"],
    substitutions: ["db_incline", "cable_fly_low", "machine_chest_press"],
  }),
  ex("bb_decline", "Decline barbell bench press", "horizontal_push", ["chest"], ["barbell", "decline_bench", "rack"], "barbell", 3, {
    secondaryMovers: ["triceps"], contraindications: ["shoulder"], setupComplexity: 2,
    substitutions: ["db_decline", "dip_chest", "cable_fly_high", "machine_chest_press"],
  }),
  ex("db_decline", "Decline dumbbell press", "horizontal_push", ["chest"], ["dumbbell", "decline_bench"], "dumbbell", 2, {
    secondaryMovers: ["triceps"],
    substitutions: ["bb_decline", "dip_chest", "cable_fly_high", "db_bench"],
  }),
  ex("dip_chest", "Chest dip", "horizontal_push", ["chest"], ["dip_station", "bodyweight"], "bodyweight", 3, {
    secondaryMovers: ["triceps", "shoulders"], contraindications: ["shoulder"],
    substitutions: ["db_decline", "cable_fly_high", "machine_chest_press"],
  }),
  ex("pushup", "Push-up", "horizontal_push", ["chest"], ["bodyweight"], "bodyweight", 1, {
    secondaryMovers: ["triceps", "shoulders", "abs"],
    substitutions: ["db_bench", "machine_chest_press", "band_chest_press"],
  }),
  ex("band_chest_press", "Banded chest press", "horizontal_push", ["chest"], ["band"], "band", 1, {
    secondaryMovers: ["triceps", "shoulders"],
    substitutions: ["pushup", "cable_press_flat", "db_bench"],
  }),
  ex("cable_fly_mid", "Cable fly", "isolation", ["chest"], ["cable"], "cable", 2, {
    substitutions: ["pec_deck", "db_fly", "cable_fly_high", "cable_fly_low"],
  }),
  ex("cable_fly_high", "Decline cable fly, high to low", "isolation", ["chest"], ["cable"], "cable", 2, {
    aliases: ["High to low cable fly", "Decline cable fly"],
    substitutions: ["db_fly_decline", "cable_fly_mid", "pec_deck", "db_fly"],
  }),
  ex("cable_fly_low", "Incline cable fly, low to high", "isolation", ["chest"], ["cable"], "cable", 2, {
    aliases: ["Low to high cable fly"],
    substitutions: ["cable_fly_mid", "db_fly", "pec_deck"],
  }),
  ex("db_fly", "Flat dumbbell fly", "isolation", ["chest"], ["dumbbell", "bench"], "dumbbell", 2, {
    contraindications: ["shoulder"],
    substitutions: ["cable_fly_mid", "pec_deck", "db_fly_decline"],
  }),
  ex("db_fly_decline", "Decline dumbbell fly", "isolation", ["chest"], ["dumbbell", "decline_bench"], "dumbbell", 2, {
    contraindications: ["shoulder"],
    substitutions: ["cable_fly_high", "db_fly", "pec_deck"],
  }),
  ex("pec_deck", "Pec deck", "isolation", ["chest"], ["machine"], "machine", 1, {
    substitutions: ["cable_fly_mid", "db_fly", "cable_fly_high"],
  }),

  /* ---------------- back ---------------- */
  ex("bb_row", "Barbell bent-over row", "horizontal_pull", ["back"], ["barbell"], "barbell", 3, {
    secondaryMovers: ["biceps", "rear_delts"], contraindications: ["lower_back"], setupComplexity: 2,
    substitutions: ["chest_supported_row_db", "cable_row", "machine_row", "db_row"],
    cues: ["Hinge to about 45 degrees and hold it", "Pull to the belly button, not the chest"],
  }),
  ex("db_row", "One-arm dumbbell row", "horizontal_pull", ["back"], ["dumbbell", "bench"], "dumbbell", 2, {
    secondaryMovers: ["biceps", "rear_delts"], unilateral: true,
    substitutions: ["cable_row", "machine_row", "chest_supported_row_db", "bb_row"],
  }),
  ex("chest_supported_row_db", "Chest supported dumbbell row", "horizontal_pull", ["back"], ["dumbbell", "incline_bench"], "dumbbell", 1, {
    secondaryMovers: ["biceps", "rear_delts"],
    substitutions: ["machine_row", "cable_row", "db_row"],
  }),
  ex("machine_row", "Chest supported row machine", "horizontal_pull", ["back"], ["machine"], "machine", 1, {
    secondaryMovers: ["biceps", "rear_delts"],
    substitutions: ["cable_row", "chest_supported_row_db", "db_row"],
  }),
  ex("cable_row", "Seated cable row", "horizontal_pull", ["back"], ["cable"], "cable", 1, {
    secondaryMovers: ["biceps", "rear_delts"],
    substitutions: ["machine_row", "chest_supported_row_db", "db_row", "band_row"],
  }),
  ex("tbar_row", "Landmine row", "horizontal_pull", ["back"], ["landmine", "barbell"], "barbell", 3, {
    aliases: ["T-bar row"], secondaryMovers: ["biceps", "rear_delts"], contraindications: ["lower_back"],
    substitutions: ["machine_row", "cable_row", "db_row"],
  }),
  ex("seal_row", "Seal row", "horizontal_pull", ["back"], ["barbell", "bench"], "barbell", 3, {
    secondaryMovers: ["biceps", "rear_delts"], setupComplexity: 3,
    substitutions: ["chest_supported_row_db", "machine_row", "cable_row"],
  }),
  ex("inverted_row", "Inverted row", "horizontal_pull", ["back"], ["barbell", "rack", "bodyweight"], "bodyweight", 2, {
    secondaryMovers: ["biceps", "rear_delts"],
    substitutions: ["cable_row", "band_row", "db_row"],
  }),
  ex("band_row", "Banded seated row", "horizontal_pull", ["back"], ["band"], "band", 1, {
    secondaryMovers: ["biceps", "rear_delts"],
    substitutions: ["cable_row", "inverted_row", "db_row"],
  }),
  ex("pullup", "Pull-up", "vertical_pull", ["back"], ["pullup_bar", "bodyweight"], "bodyweight", 3, {
    secondaryMovers: ["biceps"],
    substitutions: ["lat_pulldown", "chinup", "machine_pulldown", "band_pulldown"],
  }),
  ex("chinup", "Chin-up", "vertical_pull", ["back"], ["pullup_bar", "bodyweight"], "bodyweight", 3, {
    secondaryMovers: ["biceps"],
    substitutions: ["lat_pulldown", "pullup", "machine_pulldown"],
  }),
  ex("lat_pulldown", "Lat pulldown", "vertical_pull", ["back"], ["cable"], "cable", 1, {
    secondaryMovers: ["biceps"],
    substitutions: ["machine_pulldown", "pullup", "band_pulldown"],
  }),
  ex("machine_pulldown", "Pulldown machine", "vertical_pull", ["back"], ["machine"], "machine", 1, {
    secondaryMovers: ["biceps"],
    substitutions: ["lat_pulldown", "pullup", "band_pulldown"],
  }),
  ex("band_pulldown", "Banded pulldown", "vertical_pull", ["back"], ["band"], "band", 1, {
    secondaryMovers: ["biceps"],
    substitutions: ["lat_pulldown", "machine_pulldown", "pullup"],
  }),
  ex("straight_arm_pulldown", "Straight-arm pulldown", "isolation", ["back"], ["cable"], "cable", 2, {
    substitutions: ["db_pullover", "lat_pulldown"],
  }),
  ex("db_pullover", "Dumbbell pullover", "isolation", ["back"], ["dumbbell", "bench"], "dumbbell", 2, {
    secondaryMovers: ["chest"], contraindications: ["shoulder"],
    substitutions: ["straight_arm_pulldown", "lat_pulldown"],
  }),
  ex("rack_pull", "Rack pull", "hinge", ["back"], ["barbell", "rack"], "barbell", 3, {
    secondaryMovers: ["hamstrings", "glutes"], contraindications: ["lower_back"], setupComplexity: 2,
    substitutions: ["bb_row", "machine_row", "cable_row"],
  }),

  /* ---------------- shoulders ---------------- */
  ex("bb_ohp", "Standing barbell overhead press", "vertical_push", ["shoulders"], ["barbell", "rack"], "barbell", 3, {
    secondaryMovers: ["triceps"], mainLift: "ohp", contraindications: ["shoulder"], setupComplexity: 2,
    substitutions: ["db_shoulder_press", "machine_shoulder_press", "landmine_press", "smith_ohp"],
    cues: ["Squeeze the glutes so the ribs stay down", "Push the head through once the bar clears"],
  }),
  ex("db_shoulder_press", "Seated dumbbell shoulder press", "vertical_push", ["shoulders"], ["dumbbell", "bench"], "dumbbell", 2, {
    secondaryMovers: ["triceps"],
    substitutions: ["machine_shoulder_press", "bb_ohp", "landmine_press", "arnold_press"],
  }),
  ex("machine_shoulder_press", "Shoulder press machine", "vertical_push", ["shoulders"], ["machine"], "machine", 1, {
    secondaryMovers: ["triceps"],
    substitutions: ["db_shoulder_press", "smith_ohp", "landmine_press"],
  }),
  ex("smith_ohp", "Smith machine overhead press", "vertical_push", ["shoulders"], ["smith"], "smith", 2, {
    secondaryMovers: ["triceps"],
    substitutions: ["machine_shoulder_press", "db_shoulder_press", "bb_ohp"],
  }),
  ex("landmine_press", "Landmine press", "vertical_push", ["shoulders"], ["landmine", "barbell"], "barbell", 2, {
    secondaryMovers: ["triceps", "chest"], unilateral: true,
    substitutions: ["db_shoulder_press", "machine_shoulder_press"],
  }),
  ex("arnold_press", "Arnold press", "vertical_push", ["shoulders"], ["dumbbell", "bench"], "dumbbell", 3, {
    secondaryMovers: ["triceps"], contraindications: ["shoulder"],
    substitutions: ["db_shoulder_press", "machine_shoulder_press"],
  }),
  ex("db_lateral_raise", "Dumbbell lateral raise", "isolation", ["shoulders"], ["dumbbell"], "dumbbell", 1, {
    substitutions: ["cable_lateral_raise", "machine_lateral_raise", "band_lateral_raise"],
  }),
  ex("cable_lateral_raise", "Cable lateral raise", "isolation", ["shoulders"], ["cable"], "cable", 2, {
    unilateral: true,
    substitutions: ["db_lateral_raise", "machine_lateral_raise", "band_lateral_raise"],
  }),
  ex("machine_lateral_raise", "Lateral raise machine", "isolation", ["shoulders"], ["machine"], "machine", 1, {
    substitutions: ["db_lateral_raise", "cable_lateral_raise"],
  }),
  ex("band_lateral_raise", "Banded lateral raise", "isolation", ["shoulders"], ["band"], "band", 1, {
    substitutions: ["db_lateral_raise", "cable_lateral_raise"],
  }),
  ex("db_front_raise", "Dumbbell front raise", "isolation", ["shoulders"], ["dumbbell"], "dumbbell", 1, {
    contraindications: ["shoulder"],
    substitutions: ["db_lateral_raise", "cable_lateral_raise"],
  }),
  ex("upright_row", "Upright row", "isolation", ["shoulders"], ["barbell"], "barbell", 2, {
    secondaryMovers: ["rear_delts"], contraindications: ["shoulder"],
    substitutions: ["db_lateral_raise", "cable_lateral_raise", "machine_lateral_raise"],
  }),

  /* ---------------- rear delts ---------------- */
  ex("db_rear_fly", "Bent-over dumbbell rear delt fly", "isolation", ["rear_delts"], ["dumbbell"], "dumbbell", 2, {
    substitutions: ["reverse_pec_deck", "cable_rear_fly", "face_pull", "band_pull_apart"],
  }),
  ex("cable_rear_fly", "Cable rear delt fly", "isolation", ["rear_delts"], ["cable"], "cable", 2, {
    substitutions: ["reverse_pec_deck", "face_pull", "db_rear_fly"],
  }),
  ex("reverse_pec_deck", "Reverse pec deck", "isolation", ["rear_delts"], ["machine"], "machine", 1, {
    substitutions: ["cable_rear_fly", "db_rear_fly", "face_pull"],
  }),
  ex("face_pull", "Face pull", "isolation", ["rear_delts"], ["cable"], "cable", 2, {
    secondaryMovers: ["back"],
    substitutions: ["band_pull_apart", "reverse_pec_deck", "db_rear_fly"],
  }),
  ex("band_pull_apart", "Band pull-apart", "isolation", ["rear_delts"], ["band"], "band", 1, {
    substitutions: ["face_pull", "db_rear_fly", "reverse_pec_deck"],
  }),

  /* ---------------- triceps ---------------- */
  ex("close_grip_bench", "Close grip bench press", "horizontal_push", ["triceps"], ["barbell", "bench", "rack"], "barbell", 3, {
    secondaryMovers: ["chest", "shoulders"], setupComplexity: 2,
    substitutions: ["dip_triceps", "machine_triceps", "cable_pushdown", "diamond_pushup"],
  }),
  ex("skullcrusher", "EZ bar skullcrusher", "isolation", ["triceps"], ["ez_bar", "bench"], "barbell", 2, {
    contraindications: ["elbow"],
    substitutions: ["overhead_cable_ext", "cable_pushdown", "db_overhead_ext"],
  }),
  ex("cable_pushdown", "Cable triceps pushdown", "isolation", ["triceps"], ["cable"], "cable", 1, {
    substitutions: ["rope_pushdown", "machine_triceps", "band_pushdown", "bench_dip"],
  }),
  ex("rope_pushdown", "Rope pushdown", "isolation", ["triceps"], ["cable"], "cable", 1, {
    substitutions: ["cable_pushdown", "machine_triceps", "band_pushdown"],
  }),
  ex("overhead_cable_ext", "Overhead cable triceps extension", "isolation", ["triceps"], ["cable"], "cable", 2, {
    substitutions: ["db_overhead_ext", "skullcrusher", "cable_pushdown"],
  }),
  ex("db_overhead_ext", "Dumbbell overhead triceps extension", "isolation", ["triceps"], ["dumbbell"], "dumbbell", 2, {
    contraindications: ["elbow"],
    substitutions: ["overhead_cable_ext", "skullcrusher", "cable_pushdown"],
  }),
  ex("dip_triceps", "Triceps dip", "vertical_push", ["triceps"], ["dip_station", "bodyweight"], "bodyweight", 3, {
    secondaryMovers: ["chest"], contraindications: ["shoulder"],
    substitutions: ["close_grip_bench", "bench_dip", "machine_triceps", "cable_pushdown"],
  }),
  ex("bench_dip", "Bench dip", "isolation", ["triceps"], ["bench", "bodyweight"], "bodyweight", 1, {
    contraindications: ["shoulder"],
    substitutions: ["cable_pushdown", "diamond_pushup", "machine_triceps"],
  }),
  ex("machine_triceps", "Triceps extension machine", "isolation", ["triceps"], ["machine"], "machine", 1, {
    substitutions: ["cable_pushdown", "rope_pushdown", "bench_dip"],
  }),
  ex("band_pushdown", "Banded pushdown", "isolation", ["triceps"], ["band"], "band", 1, {
    substitutions: ["cable_pushdown", "bench_dip", "diamond_pushup"],
  }),
  ex("diamond_pushup", "Diamond push-up", "horizontal_push", ["triceps"], ["bodyweight"], "bodyweight", 2, {
    secondaryMovers: ["chest"],
    substitutions: ["bench_dip", "cable_pushdown", "close_grip_bench"],
  }),

  /* ---------------- biceps ---------------- */
  ex("bb_curl", "Barbell curl", "isolation", ["biceps"], ["barbell"], "barbell", 2, {
    contraindications: ["wrist"],
    substitutions: ["ez_curl", "db_curl", "cable_curl", "machine_curl"],
  }),
  ex("ez_curl", "EZ bar curl", "isolation", ["biceps"], ["ez_bar"], "barbell", 1, {
    substitutions: ["db_curl", "cable_curl", "machine_curl", "bb_curl"],
  }),
  ex("db_curl", "Dumbbell curl", "isolation", ["biceps"], ["dumbbell"], "dumbbell", 1, {
    substitutions: ["cable_curl", "ez_curl", "hammer_curl", "band_curl"],
  }),
  ex("hammer_curl", "Hammer curl", "isolation", ["biceps"], ["dumbbell"], "dumbbell", 1, {
    secondaryMovers: ["forearms"],
    substitutions: ["db_curl", "cable_curl", "reverse_curl"],
  }),
  ex("incline_db_curl", "Incline dumbbell curl", "isolation", ["biceps"], ["dumbbell", "incline_bench"], "dumbbell", 2, {
    substitutions: ["db_curl", "cable_curl", "preacher_curl"],
  }),
  ex("cable_curl", "Cable curl", "isolation", ["biceps"], ["cable"], "cable", 1, {
    substitutions: ["db_curl", "machine_curl", "ez_curl", "band_curl"],
  }),
  ex("preacher_curl", "Preacher curl", "isolation", ["biceps"], ["ez_bar", "bench"], "barbell", 2, {
    contraindications: ["elbow"],
    substitutions: ["machine_curl", "incline_db_curl", "cable_curl"],
  }),
  ex("machine_curl", "Biceps curl machine", "isolation", ["biceps"], ["machine"], "machine", 1, {
    substitutions: ["cable_curl", "db_curl", "preacher_curl"],
  }),
  ex("band_curl", "Banded curl", "isolation", ["biceps"], ["band"], "band", 1, {
    substitutions: ["db_curl", "cable_curl", "machine_curl"],
  }),
  ex("concentration_curl", "Concentration curl", "isolation", ["biceps"], ["dumbbell", "bench"], "dumbbell", 1, {
    unilateral: true,
    substitutions: ["db_curl", "cable_curl", "incline_db_curl"],
  }),

  /* ---------------- quads ---------------- */
  ex("bb_back_squat", "Barbell back squat", "squat", ["quads"], ["barbell", "rack"], "barbell", 4, {
    secondaryMovers: ["glutes", "hamstrings"], mainLift: "squat", contraindications: ["lower_back"], setupComplexity: 2,
    substitutions: ["hack_squat", "leg_press", "goblet_squat", "smith_squat"],
    cues: ["Brace before you unrack, not after", "Knees track over the middle of the foot", "Depth before load"],
  }),
  ex("bb_front_squat", "Front squat", "squat", ["quads"], ["barbell", "rack"], "barbell", 5, {
    secondaryMovers: ["glutes", "abs"], setupComplexity: 3,
    substitutions: ["hack_squat", "goblet_squat", "leg_press", "bb_back_squat"],
  }),
  ex("goblet_squat", "Goblet squat", "squat", ["quads"], ["dumbbell"], "dumbbell", 1, {
    secondaryMovers: ["glutes"],
    substitutions: ["leg_press", "bb_back_squat", "hack_squat", "bw_squat"],
  }),
  ex("hack_squat", "Hack squat machine", "squat", ["quads"], ["machine"], "machine", 2, {
    secondaryMovers: ["glutes"],
    substitutions: ["leg_press", "bb_back_squat", "smith_squat", "goblet_squat"],
  }),
  ex("leg_press", "Leg press", "squat", ["quads"], ["machine"], "machine", 1, {
    secondaryMovers: ["glutes", "hamstrings"],
    substitutions: ["hack_squat", "goblet_squat", "smith_squat", "bb_back_squat"],
  }),
  ex("smith_squat", "Smith machine squat", "squat", ["quads"], ["smith"], "smith", 2, {
    secondaryMovers: ["glutes"],
    substitutions: ["hack_squat", "leg_press", "bb_back_squat"],
  }),
  ex("belt_squat", "Safety bar squat", "squat", ["quads"], ["specialty_bar", "rack"], "barbell", 3, {
    secondaryMovers: ["glutes"], setupComplexity: 2,
    substitutions: ["hack_squat", "leg_press", "bb_back_squat"],
  }),
  ex("split_squat", "Bulgarian split squat", "lunge", ["quads"], ["dumbbell", "bench"], "dumbbell", 3, {
    secondaryMovers: ["glutes"], unilateral: true, contraindications: ["knee"],
    substitutions: ["walking_lunge", "step_up", "leg_press", "goblet_squat"],
  }),
  ex("walking_lunge", "Walking lunge", "lunge", ["quads"], ["dumbbell"], "dumbbell", 2, {
    secondaryMovers: ["glutes"], unilateral: true, contraindications: ["knee"],
    substitutions: ["split_squat", "step_up", "leg_press"],
  }),
  ex("step_up", "Step-up", "lunge", ["quads"], ["dumbbell", "box"], "dumbbell", 2, {
    secondaryMovers: ["glutes"], unilateral: true, contraindications: ["knee"],
    substitutions: ["split_squat", "walking_lunge", "leg_press"],
  }),
  ex("leg_extension", "Leg extension", "isolation", ["quads"], ["machine"], "machine", 1, {
    contraindications: ["knee"],
    substitutions: ["leg_press", "goblet_squat", "bw_squat"],
  }),
  ex("bw_squat", "Bodyweight squat", "squat", ["quads"], ["bodyweight"], "bodyweight", 1, {
    secondaryMovers: ["glutes"],
    substitutions: ["goblet_squat", "band_squat", "leg_press"],
  }),
  ex("band_squat", "Banded squat", "squat", ["quads"], ["band"], "band", 1, {
    secondaryMovers: ["glutes"],
    substitutions: ["bw_squat", "goblet_squat", "leg_press"],
  }),
  ex("sled_push", "Sled push", "carry", ["quads"], ["sled"], "bodyweight", 1, {
    secondaryMovers: ["glutes", "calves"],
    substitutions: ["walking_lunge", "leg_press"],
  }),

  /* ---------------- hamstrings ---------------- */
  ex("bb_deadlift", "Conventional deadlift", "hinge", ["hamstrings", "glutes"], ["barbell"], "barbell", 4, {
    secondaryMovers: ["back"], mainLift: "deadlift", contraindications: ["lower_back"], setupComplexity: 2,
    substitutions: ["trap_bar_dl", "rdl", "db_rdl", "lying_leg_curl"],
    cues: ["Take the slack out of the bar before you pull", "Push the floor away rather than lifting the bar"],
  }),
  ex("sumo_deadlift", "Sumo deadlift", "hinge", ["hamstrings", "glutes"], ["barbell"], "barbell", 4, {
    secondaryMovers: ["quads"], contraindications: ["lower_back", "hip"], setupComplexity: 2,
    substitutions: ["bb_deadlift", "trap_bar_dl", "rdl"],
  }),
  ex("trap_bar_dl", "Trap bar deadlift", "hinge", ["hamstrings", "glutes"], ["specialty_bar"], "barbell", 2, {
    secondaryMovers: ["quads"], contraindications: ["lower_back"],
    substitutions: ["bb_deadlift", "rdl", "lying_leg_curl"],
  }),
  ex("rdl", "Romanian deadlift", "hinge", ["hamstrings", "glutes"], ["barbell", "rack"], "barbell", 3, { contraindications: ["lower_back"],
    substitutions: ["db_rdl", "lying_leg_curl", "seated_leg_curl", "cable_pull_through"],
  }),
  ex("db_rdl", "Dumbbell Romanian deadlift", "hinge", ["hamstrings", "glutes"], ["dumbbell"], "dumbbell", 2, { contraindications: ["lower_back"],
    substitutions: ["rdl", "lying_leg_curl", "cable_pull_through"],
  }),
  ex("good_morning", "Good morning", "hinge", ["hamstrings", "glutes"], ["barbell", "rack"], "barbell", 4, { contraindications: ["lower_back"], setupComplexity: 2,
    substitutions: ["rdl", "seated_leg_curl", "back_extension"],
  }),
  ex("lying_leg_curl", "Lying leg curl", "isolation", ["hamstrings"], ["machine"], "machine", 1, {
    substitutions: ["seated_leg_curl", "nordic_curl", "band_leg_curl", "db_rdl"],
  }),
  ex("seated_leg_curl", "Seated leg curl", "isolation", ["hamstrings"], ["machine"], "machine", 1, {
    substitutions: ["lying_leg_curl", "nordic_curl", "band_leg_curl"],
  }),
  ex("nordic_curl", "Nordic hamstring curl", "isolation", ["hamstrings"], ["bodyweight"], "bodyweight", 4, {
    substitutions: ["lying_leg_curl", "seated_leg_curl", "db_rdl"],
  }),
  ex("band_leg_curl", "Banded leg curl", "isolation", ["hamstrings"], ["band"], "band", 1, {
    substitutions: ["lying_leg_curl", "nordic_curl", "db_rdl"],
  }),
  ex("kb_swing", "Kettlebell swing", "hinge", ["hamstrings", "glutes"], ["kettlebell"], "kettlebell", 3, { contraindications: ["lower_back"],
    substitutions: ["db_rdl", "cable_pull_through", "hip_thrust"],
  }),

  /* ---------------- glutes ---------------- */
  ex("hip_thrust", "Barbell hip thrust", "hinge", ["glutes", "hamstrings"], ["barbell", "bench"], "barbell", 2, { setupComplexity: 2,
    substitutions: ["machine_hip_thrust", "db_hip_thrust", "glute_bridge", "cable_pull_through"],
  }),
  ex("db_hip_thrust", "Dumbbell hip thrust", "hinge", ["glutes", "hamstrings"], ["dumbbell", "bench"], "dumbbell", 1, {
    substitutions: ["hip_thrust", "machine_hip_thrust", "glute_bridge"],
  }),
  ex("machine_hip_thrust", "Hip thrust machine", "hinge", ["glutes", "hamstrings"], ["machine"], "machine", 1, {
    substitutions: ["hip_thrust", "db_hip_thrust", "cable_pull_through"],
  }),
  ex("glute_bridge", "Glute bridge", "hinge", ["glutes", "hamstrings"], ["bodyweight"], "bodyweight", 1, {
    substitutions: ["db_hip_thrust", "hip_thrust", "cable_pull_through"],
  }),
  ex("cable_pull_through", "Cable pull-through", "hinge", ["glutes", "hamstrings"], ["cable"], "cable", 2, {
    substitutions: ["hip_thrust", "db_rdl", "glute_bridge"],
  }),
  ex("cable_kickback", "Cable glute kickback", "isolation", ["glutes"], ["cable"], "cable", 1, {
    unilateral: true,
    substitutions: ["cable_pull_through", "glute_bridge", "hip_thrust"],
  }),
  ex("back_extension", "45 degree back extension", "hinge", ["glutes", "hamstrings"], ["machine", "bodyweight"], "bodyweight", 2, {
    secondaryMovers: ["back"], contraindications: ["lower_back"],
    substitutions: ["glute_bridge", "cable_pull_through", "db_rdl"],
  }),

  /* ---------------- calves ---------------- */
  ex("standing_calf_raise", "Standing calf raise", "isolation", ["calves"], ["machine"], "machine", 1, {
    substitutions: ["smith_calf_raise", "db_calf_raise", "leg_press_calf", "bw_calf_raise"],
  }),
  ex("seated_calf_raise", "Seated calf raise", "isolation", ["calves"], ["machine"], "machine", 1, {
    substitutions: ["standing_calf_raise", "leg_press_calf", "db_calf_raise"],
  }),
  ex("leg_press_calf", "Calf press on the leg press", "isolation", ["calves"], ["machine"], "machine", 1, {
    substitutions: ["standing_calf_raise", "seated_calf_raise", "db_calf_raise"],
  }),
  ex("smith_calf_raise", "Smith machine calf raise", "isolation", ["calves"], ["smith", "box"], "smith", 1, {
    substitutions: ["standing_calf_raise", "db_calf_raise", "bw_calf_raise"],
  }),
  ex("db_calf_raise", "Dumbbell standing calf raise", "isolation", ["calves"], ["dumbbell"], "dumbbell", 1, {
    substitutions: ["standing_calf_raise", "bw_calf_raise", "smith_calf_raise"],
  }),
  ex("bw_calf_raise", "Bodyweight calf raise", "isolation", ["calves"], ["bodyweight"], "bodyweight", 1, {
    substitutions: ["db_calf_raise", "standing_calf_raise"],
  }),

  /* ---------------- forearms ---------------- */
  ex("farmers_carry", "Farmer's carry", "carry", ["forearms"], ["dumbbell"], "dumbbell", 1, {
    secondaryMovers: ["abs"],
    substitutions: ["dead_hang", "wrist_curl", "reverse_curl"],
  }),
  ex("wrist_curl", "Dumbbell wrist curl", "isolation", ["forearms"], ["dumbbell", "bench"], "dumbbell", 1, {
    contraindications: ["wrist"],
    substitutions: ["reverse_curl", "farmers_carry", "dead_hang"],
  }),
  ex("reverse_curl", "Reverse curl", "isolation", ["forearms", "biceps"], ["ez_bar"], "barbell", 1, {
    substitutions: ["hammer_curl", "wrist_curl", "farmers_carry"],
  }),
  ex("dead_hang", "Dead hang", "carry", ["forearms"], ["pullup_bar", "bodyweight"], "bodyweight", 1, {
    substitutions: ["farmers_carry", "wrist_curl"],
  }),

  /* ---------------- abs ---------------- */
  ex("cable_crunch", "Cable crunch", "isolation", ["abs"], ["cable"], "cable", 1, {
    substitutions: ["machine_crunch", "hanging_leg_raise", "weighted_situp", "plank"],
  }),
  ex("hanging_leg_raise", "Hanging leg raise", "isolation", ["abs"], ["pullup_bar", "bodyweight"], "bodyweight", 3, {
    substitutions: ["cable_crunch", "weighted_situp", "dead_bug"],
  }),
  ex("machine_crunch", "Abdominal crunch machine", "isolation", ["abs"], ["machine"], "machine", 1, {
    substitutions: ["cable_crunch", "weighted_situp", "plank"],
  }),
  ex("weighted_situp", "Decline sit-up", "isolation", ["abs"], ["decline_bench", "bodyweight"], "bodyweight", 2, {
    contraindications: ["lower_back"],
    substitutions: ["cable_crunch", "machine_crunch", "dead_bug"],
  }),
  ex("ab_wheel", "Ab wheel rollout", "isolation", ["abs"], ["bodyweight"], "bodyweight", 3, {
    contraindications: ["lower_back"],
    substitutions: ["plank", "cable_crunch", "hanging_leg_raise"],
  }),
  ex("plank", "Plank", "isolation", ["abs"], ["bodyweight"], "bodyweight", 1, {
    substitutions: ["dead_bug", "pallof_press", "cable_crunch"],
  }),
  ex("dead_bug", "Dead bug", "isolation", ["abs"], ["bodyweight"], "bodyweight", 1, {
    substitutions: ["plank", "pallof_press", "cable_crunch"],
  }),
  ex("pallof_press", "Pallof press", "isolation", ["abs"], ["cable"], "cable", 2, {
    substitutions: ["plank", "dead_bug", "cable_crunch"],
  }),
];

/* ------------------------------------------------------------------ */
/* Movement families                                                   */
/* ------------------------------------------------------------------ */

/**
 * Exercises that are the same movement with different hardware. A session
 * takes at most one from a family before it reaches for another, which is what
 * stops a chest day becoming three flies or a calf day becoming three identical
 * raises.
 *
 * Granularity is the judgement here. Flat and incline pressing are separate
 * because they are programmed together on purpose. Standing and seated calf
 * raises are separate because a bent knee changes which muscle does the work.
 * Dumbbell, cable and machine lateral raises are one family because they are
 * the same movement.
 */
const FAMILIES: Record<string, string> = {
  bb_bench: "bench_press", db_bench: "bench_press", machine_chest_press: "bench_press",
  smith_bench: "bench_press", cable_press_flat: "bench_press", pushup: "bench_press",
  band_chest_press: "bench_press",
  bb_incline: "incline_press", db_incline: "incline_press", machine_incline_press: "incline_press",
  bb_decline: "decline_press", db_decline: "decline_press", dip_chest: "decline_press",
  cable_fly_mid: "chest_fly", cable_fly_high: "chest_fly", cable_fly_low: "chest_fly",
  db_fly: "chest_fly", db_fly_decline: "chest_fly", pec_deck: "chest_fly",

  bb_row: "row", db_row: "row", chest_supported_row_db: "row", machine_row: "row",
  cable_row: "row", tbar_row: "row", seal_row: "row", inverted_row: "row", band_row: "row",
  pullup: "pulldown", chinup: "pulldown", lat_pulldown: "pulldown",
  machine_pulldown: "pulldown", band_pulldown: "pulldown",
  straight_arm_pulldown: "pullover", db_pullover: "pullover",
  rack_pull: "rack_pull",

  bb_ohp: "overhead_press", db_shoulder_press: "overhead_press",
  machine_shoulder_press: "overhead_press", smith_ohp: "overhead_press",
  landmine_press: "overhead_press", arnold_press: "overhead_press",
  db_lateral_raise: "lateral_raise", cable_lateral_raise: "lateral_raise",
  machine_lateral_raise: "lateral_raise", band_lateral_raise: "lateral_raise",
  db_front_raise: "front_raise", upright_row: "front_raise",
  db_rear_fly: "rear_delt_fly", cable_rear_fly: "rear_delt_fly",
  reverse_pec_deck: "rear_delt_fly", band_pull_apart: "rear_delt_fly",
  face_pull: "face_pull",

  close_grip_bench: "close_grip_press", dip_triceps: "close_grip_press",
  diamond_pushup: "close_grip_press",
  skullcrusher: "triceps_overhead", overhead_cable_ext: "triceps_overhead",
  db_overhead_ext: "triceps_overhead",
  cable_pushdown: "pushdown", rope_pushdown: "pushdown", machine_triceps: "pushdown",
  band_pushdown: "pushdown", bench_dip: "pushdown",

  bb_curl: "curl", ez_curl: "curl", db_curl: "curl", cable_curl: "curl",
  machine_curl: "curl", band_curl: "curl", preacher_curl: "curl",
  concentration_curl: "curl", incline_db_curl: "curl",
  hammer_curl: "neutral_curl", reverse_curl: "neutral_curl",

  bb_back_squat: "squat", bb_front_squat: "squat", goblet_squat: "squat",
  hack_squat: "squat", leg_press: "squat", smith_squat: "squat",
  belt_squat: "squat", bw_squat: "squat", band_squat: "squat",
  split_squat: "lunge", walking_lunge: "lunge", step_up: "lunge",
  leg_extension: "leg_extension", sled_push: "carry",

  bb_deadlift: "deadlift", sumo_deadlift: "deadlift", trap_bar_dl: "deadlift",
  rdl: "rdl", db_rdl: "rdl", good_morning: "rdl", kb_swing: "rdl",
  lying_leg_curl: "leg_curl_lying", nordic_curl: "leg_curl_lying", band_leg_curl: "leg_curl_lying",
  seated_leg_curl: "leg_curl_seated",

  hip_thrust: "hip_thrust", db_hip_thrust: "hip_thrust", machine_hip_thrust: "hip_thrust",
  glute_bridge: "hip_thrust", cable_pull_through: "hip_thrust",
  back_extension: "back_extension", cable_kickback: "kickback",

  standing_calf_raise: "calf_standing", smith_calf_raise: "calf_standing",
  db_calf_raise: "calf_standing", bw_calf_raise: "calf_standing",
  leg_press_calf: "calf_standing", seated_calf_raise: "calf_seated",

  farmers_carry: "carry", dead_hang: "carry", wrist_curl: "wrist", reverse_curl_wrist: "wrist",

  cable_crunch: "ab_flexion", machine_crunch: "ab_flexion", weighted_situp: "ab_flexion",
  hanging_leg_raise: "leg_raise",
  plank: "ab_brace", dead_bug: "ab_brace", pallof_press: "ab_brace", ab_wheel: "ab_brace",
};

/** Falls back to pattern and prime mover for anything not listed above. */
export const familyOf = (e: Exercise): string =>
  FAMILIES[e.id] ?? `${e.primeMovers[0] ?? "other"}_${e.pattern}`;

/* ------------------------------------------------------------------ */
/* Lookups                                                             */
/* ------------------------------------------------------------------ */

const BY_ID = new Map(EXERCISES.map((e) => [e.id, e]));

export const exerciseById = (id: string): Exercise | undefined => BY_ID.get(id);

/** Items a client can reach, given every access option they selected. */
export function availableEquipment(selected: readonly Equipment[]): Set<EquipmentItem> {
  const items = new Set<EquipmentItem>(["bodyweight"]);
  for (const profile of selected) {
    for (const item of EQUIPMENT_PROFILES[profile] ?? []) items.add(item);
  }
  return items;
}

export const canPerform = (e: Exercise, available: ReadonlySet<EquipmentItem>): boolean =>
  e.equipment.every((item) => available.has(item));

export const isContraindicated = (e: Exercise, sites: readonly InjurySite[]): boolean =>
  (e.contraindications ?? []).some((site) => sites.includes(site));

export const trains = (e: Exercise, muscle: MuscleGroup): boolean => e.primeMovers.includes(muscle);
