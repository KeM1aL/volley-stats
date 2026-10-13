-- Archived members are hidden from rosters and match setup and lose app-level team access,
-- but stay referenced by past matches (player_stats, events, score_points, match rosters).
ALTER TABLE team_members ADD COLUMN archived_at timestamptz NULL;

COMMENT ON COLUMN team_members.archived_at IS
  'When the member was archived: hidden from rosters and match setup, kept in past matches, no team access in the app. NULL = active.';
