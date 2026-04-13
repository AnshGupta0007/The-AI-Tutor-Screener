-- Add invite code fields to sessions
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS invite_code CHAR(6),
  ADD COLUMN IF NOT EXISTS invite_expires_at TIMESTAMPTZ;

-- Index for fast code lookups
CREATE INDEX IF NOT EXISTS idx_sessions_invite_code ON sessions (invite_code);
