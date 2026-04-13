-- Track interview completion percentage on sessions
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS completion_pct INTEGER DEFAULT 100;
