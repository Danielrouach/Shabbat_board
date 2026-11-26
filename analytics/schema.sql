-- Shabbat Board analytics: only visitor telemetry, never schedule data.
CREATE TABLE IF NOT EXISTS visits (
  id TEXT PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  screen TEXT NOT NULL CHECK (screen IN ('board','elevator')),
  path TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  last_seen INTEGER NOT NULL,
  ip TEXT,
  country TEXT,
  city TEXT,
  browser TEXT,
  os TEXT,
  device TEXT,
  referrer TEXT
);
CREATE INDEX IF NOT EXISTS idx_visits_started_at ON visits(started_at);
CREATE INDEX IF NOT EXISTS idx_visits_last_seen ON visits(last_seen);
CREATE INDEX IF NOT EXISTS idx_visits_screen_start ON visits(screen,started_at);
CREATE INDEX IF NOT EXISTS idx_visits_visitor_id ON visits(visitor_id);
CREATE TABLE IF NOT EXISTS login_attempts (
  ip_hash TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  attempts INTEGER NOT NULL
);
