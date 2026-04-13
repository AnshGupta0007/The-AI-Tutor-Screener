-- Cuemath AI Tutor Screener — Initial Schema

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_name TEXT,
  candidate_email TEXT,
  status TEXT DEFAULT 'pending',
  -- status values: pending | active | completed | evaluated | abandoned
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  recording_path TEXT
  -- e.g. recordings/550e8400-e29b-41d4-a716-446655440000.webm
);

CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  session_id UUID REFERENCES sessions(id),
  role TEXT NOT NULL,
  -- values: assistant | user | system
  content TEXT NOT NULL,
  confidence FLOAT,
  -- STT confidence score for user messages; null for assistant messages
  turn_number INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS evaluations (
  id SERIAL PRIMARY KEY,
  session_id UUID REFERENCES sessions(id) UNIQUE,
  clarity FLOAT,
  teaching_ability FLOAT,
  patience FLOAT,
  warmth FLOAT,
  fluency FLOAT,
  composite_score FLOAT,
  recommendation TEXT,
  -- values: strong_hire | consider | do_not_advance
  justifications JSONB,
  -- { "clarity": "...", "teaching_ability": "...", ... }
  flags JSONB,
  -- ["THIN_ANSWER", "EXAMPLE_RICH", ...]
  key_excerpts JSONB,
  -- { "clarity": ["quote1", "quote2"], ... }
  raw_eval_response TEXT,
  -- Full raw Claude response for debugging
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_session_id ON evaluations(session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at DESC);

-- Row Level Security
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;

-- Service role has full access (used by API routes)
CREATE POLICY "Service role full access on sessions"
  ON sessions FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access on messages"
  ON messages FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access on evaluations"
  ON evaluations FOR ALL
  USING (true)
  WITH CHECK (true);
