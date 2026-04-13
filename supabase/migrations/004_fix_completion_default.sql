-- Fix completion_pct default to NULL (was incorrectly 100, making all sessions show 100% even when active)
ALTER TABLE sessions ALTER COLUMN completion_pct SET DEFAULT NULL;

-- Clear the misleading 100% from sessions that never actually completed
UPDATE sessions
SET completion_pct = NULL
WHERE completion_pct = 100
  AND status NOT IN ('completed', 'evaluated');
