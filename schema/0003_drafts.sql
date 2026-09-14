-- Part-finished intakes.
--
-- Keyed by a token that lives in the URL rather than in localStorage, so a
-- client can start on a phone and finish on a laptop. The row holds personal
-- data before anyone has consented to anything, so it carries a short life and
-- is purged on write rather than kept.
CREATE TABLE drafts (
  token             TEXT PRIMARY KEY,
  payload           TEXT NOT NULL,               -- JSON, a partial Intake
  step              INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
  submitted_at      TEXT
);
CREATE INDEX idx_drafts_updated ON drafts(updated_at);
