CREATE TABLE IF NOT EXISTS profiles (
  wallet TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  wallet TEXT NOT NULL,
  data JSONB NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS runs_wallet_idx ON runs(wallet);

CREATE TABLE IF NOT EXISTS analytics_events (
  id TEXT PRIMARY KEY,
  wallet TEXT,
  type TEXT NOT NULL,
  payload JSONB NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  request_id TEXT
);

CREATE INDEX IF NOT EXISTS analytics_events_occurred_idx ON analytics_events(occurred_at DESC);
