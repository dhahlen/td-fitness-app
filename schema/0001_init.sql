-- Program engine, initial schema.
-- D1 (SQLite). Apply with: npm run db:local  /  npm run db:remote

CREATE TABLE clients (
  id                TEXT PRIMARY KEY,            -- uuid
  name              TEXT NOT NULL,
  email             TEXT NOT NULL UNIQUE,
  phone             TEXT,
  dob               TEXT NOT NULL,
  sex               TEXT NOT NULL CHECK (sex IN ('male','female')),
  timezone          TEXT,
  status            TEXT NOT NULL DEFAULT 'intake'
                      CHECK (status IN ('intake','pending_clearance','manual_review','active','paused','archived')),
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Full intake payload kept verbatim. Never mutate a submission; insert a new
-- row on re-intake so the history of what drove each program stays intact.
CREATE TABLE intakes (
  id                TEXT PRIMARY KEY,
  client_id         TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  payload           TEXT NOT NULL,               -- JSON, matches src/types.ts Intake
  schema_version    INTEGER NOT NULL DEFAULT 1,
  submitted_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_intakes_client ON intakes(client_id, submitted_at DESC);

-- Generated program. Regenerating writes a new row; the active one is flagged.
CREATE TABLE programs (
  id                TEXT PRIMARY KEY,
  client_id         TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  intake_id         TEXT NOT NULL REFERENCES intakes(id),
  engine_version    TEXT NOT NULL,
  level             TEXT NOT NULL,
  level_score       INTEGER NOT NULL,
  goal              TEXT NOT NULL,
  days_per_week     INTEGER NOT NULL,
  block_weeks       INTEGER NOT NULL,
  output            TEXT NOT NULL,               -- JSON, matches Program
  coach_approved    INTEGER NOT NULL DEFAULT 0,
  coach_notes       TEXT,
  is_active         INTEGER NOT NULL DEFAULT 0,
  starts_on         TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_programs_client ON programs(client_id, created_at DESC);
CREATE UNIQUE INDEX idx_programs_active ON programs(client_id) WHERE is_active = 1;

-- Safety flags surfaced separately so the coach dashboard can query them
-- without parsing JSON.
CREATE TABLE safety_flags (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id         TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  program_id        TEXT REFERENCES programs(id) ON DELETE CASCADE,
  code              TEXT NOT NULL,
  severity          TEXT NOT NULL CHECK (severity IN ('block','hold','notice')),
  message           TEXT NOT NULL,
  resolved_at       TEXT,
  resolved_by       TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_flags_open ON safety_flags(client_id, resolved_at);

CREATE TABLE medical_clearances (
  id                TEXT PRIMARY KEY,
  client_id         TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  requested_at      TEXT NOT NULL DEFAULT (datetime('now')),
  received_at       TEXT,
  document_key      TEXT,                        -- R2 object key
  provider_name     TEXT,
  restrictions      TEXT,
  cleared           INTEGER
);

-- Exercise library. The substitution graph is what makes equipment and
-- injury handling work, so keep it as real relationships.
CREATE TABLE exercises (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  aliases           TEXT,                        -- JSON array
  movement_pattern  TEXT NOT NULL,
  prime_movers      TEXT NOT NULL,               -- JSON array of muscle ids
  secondary_movers  TEXT,                        -- JSON array
  equipment         TEXT NOT NULL,               -- JSON array
  loading_type      TEXT NOT NULL,
  skill_level       INTEGER NOT NULL CHECK (skill_level BETWEEN 1 AND 5),
  setup_complexity  INTEGER NOT NULL DEFAULT 1,
  unilateral        INTEGER NOT NULL DEFAULT 0,
  contraindications TEXT,                        -- JSON array of injury sites
  coaching_cues     TEXT,                        -- JSON array
  video_url         TEXT
);
CREATE INDEX idx_ex_pattern ON exercises(movement_pattern);

CREATE TABLE exercise_substitutions (
  exercise_id       TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  substitute_id     TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  rank              INTEGER NOT NULL,
  reason            TEXT,                        -- 'equipment' | 'injury' | 'preference'
  PRIMARY KEY (exercise_id, substitute_id)
);

CREATE TABLE exercise_supersets (
  exercise_id       TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  pair_id           TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  PRIMARY KEY (exercise_id, pair_id)
);

-- Logged training. Feeds progression, check-ins, and phase 2 scoring.
CREATE TABLE sessions (
  id                TEXT PRIMARY KEY,
  client_id         TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  program_id        TEXT NOT NULL REFERENCES programs(id),
  week              INTEGER NOT NULL,
  day               INTEGER NOT NULL,
  scheduled_for     TEXT,
  completed_at      TEXT,
  duration_min      INTEGER,
  readiness         INTEGER,                     -- 1-10 self report
  notes             TEXT
);
CREATE INDEX idx_sessions_client ON sessions(client_id, scheduled_for);

CREATE TABLE set_logs (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id        TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  exercise_id       TEXT NOT NULL REFERENCES exercises(id),
  set_index         INTEGER NOT NULL,
  weight_kg         REAL,
  reps              INTEGER,
  rir               INTEGER,
  est_1rm           REAL,
  is_working_set    INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX idx_setlogs_session ON set_logs(session_id);

CREATE TABLE checkins (
  id                TEXT PRIMARY KEY,
  client_id         TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  week_ending       TEXT NOT NULL,
  trend_weight_kg   REAL,
  waist_cm          REAL,
  hip_cm            REAL,
  avg_sleep_hours   REAL,
  avg_stress        INTEGER,
  adherence_pct     INTEGER,
  photo_keys        TEXT,                        -- JSON array of R2 keys
  coach_response    TEXT,
  calories_after    INTEGER,                     -- what the adjustment loop set
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX idx_checkins_week ON checkins(client_id, week_ending);

-- Phase 2. Columns exist now so the retrofit is not needed later.
CREATE TABLE baselines (
  client_id         TEXT PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
  captured_at       TEXT NOT NULL DEFAULT (datetime('now')),
  weight_kg         REAL,
  body_fat_pct      REAL,
  est_1rm_total     REAL,
  level             TEXT
);

CREATE TABLE leaderboard_consent (
  client_id         TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  metric            TEXT NOT NULL,               -- 'consistency' | 'strength' | 'body_comp'
  visible           INTEGER NOT NULL DEFAULT 0,
  updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (client_id, metric)
);

CREATE TABLE scores (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id         TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  week_ending       TEXT NOT NULL,
  cohort            TEXT NOT NULL,               -- level + goal bucket
  consistency_pts   REAL NOT NULL DEFAULT 0,
  progression_pts   REAL NOT NULL DEFAULT 0,
  body_comp_pts     REAL NOT NULL DEFAULT 0,
  engagement_pts    REAL NOT NULL DEFAULT 0,
  total_pts         REAL NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX idx_scores_week ON scores(client_id, week_ending);
