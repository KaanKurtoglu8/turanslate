-- Turanslate initial schema.
-- All timestamps are UTC ISO-8601 strings written by the Worker (e.g. 2026-09-23T10:15:30.123Z),
-- so they compare correctly as text.

CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT    NOT NULL UNIQUE,
  -- Encoded as pbkdf2_sha256$<iterations>$<salt_b64>$<hash_b64>; the per-user salt lives inside.
  password_hash TEXT    NOT NULL,
  role          TEXT    NOT NULL CHECK (role IN ('admin', 'user')),
  is_active     INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at    TEXT    NOT NULL,
  updated_at    TEXT    NOT NULL
);

CREATE TABLE sessions (
  -- HMAC-SHA256 of the opaque bearer token; the raw token is never stored.
  token_hash TEXT    PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at TEXT    NOT NULL,
  expires_at TEXT    NOT NULL,
  revoked_at TEXT
);

CREATE INDEX sessions_user_id ON sessions (user_id);
CREATE INDEX sessions_expires_at ON sessions (expires_at);

-- Failed-login counters for bounded lockouts. Keys look like "user:<name>" or "ip:<address>".
CREATE TABLE login_throttle (
  key               TEXT    PRIMARY KEY,
  failures          INTEGER NOT NULL,
  window_started_at TEXT    NOT NULL,
  locked_until      TEXT
);

CREATE TABLE query_logs (
  id                        INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id                   INTEGER NOT NULL REFERENCES users (id),
  -- Snapshot of the username at request time (also joinable through user_id).
  username                  TEXT    NOT NULL,
  created_at                TEXT    NOT NULL,
  completed_at              TEXT,
  duration_ms               INTEGER,
  input_text                TEXT    NOT NULL,
  source_mode               TEXT    NOT NULL,
  -- detectedSource exactly as returned by the model (may differ from the returned result
  -- when the user chose an explicit source).
  detected_source           TEXT,
  model                     TEXT    NOT NULL,
  status                    TEXT    NOT NULL CHECK (status IN ('pending', 'success', 'failure')),
  error_code                TEXT,
  error_message             TEXT,
  -- The complete validated result returned to the user (TranslationResult JSON).
  response_json             TEXT,
  input_tokens              INTEGER,
  output_tokens             INTEGER,
  total_tokens              INTEGER,
  cached_input_tokens       INTEGER,
  reasoning_tokens          INTEGER,
  input_price_usd_per_1m    REAL,
  output_price_usd_per_1m   REAL,
  estimated_input_cost_usd  REAL,
  estimated_output_cost_usd REAL,
  estimated_total_cost_usd  REAL
);

CREATE INDEX query_logs_user_id ON query_logs (user_id, id DESC);
CREATE INDEX query_logs_username ON query_logs (username, id DESC);
