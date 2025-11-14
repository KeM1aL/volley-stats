-- Migration: Server-Generated Timestamps
-- This migration adds triggers to automatically set updated_at timestamps on all tables
-- This eliminates client clock skew issues and ensures reliable Last-Write-Wins conflict resolution

-- Create function to auto-update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply UPDATE trigger to all 13 tables
CREATE OR REPLACE TRIGGER  update_clubs_updated_at
  BEFORE UPDATE ON clubs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER  update_club_members_updated_at
  BEFORE UPDATE ON club_members
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER  update_teams_updated_at
  BEFORE UPDATE ON teams
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER  update_team_members_updated_at
  BEFORE UPDATE ON team_members
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER  update_championships_updated_at
  BEFORE UPDATE ON championships
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER  update_seasons_updated_at
  BEFORE UPDATE ON seasons
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER  update_match_formats_updated_at
  BEFORE UPDATE ON match_formats
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER  update_matches_updated_at
  BEFORE UPDATE ON matches
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER  update_sets_updated_at
  BEFORE UPDATE ON sets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER  update_substitutions_updated_at
  BEFORE UPDATE ON substitutions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER  update_score_points_updated_at
  BEFORE UPDATE ON score_points
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER  update_player_stats_updated_at
  BEFORE UPDATE ON player_stats
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER  update_events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Set defaults for created_at columns (server-generated on INSERT)
ALTER TABLE clubs ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE club_members ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE teams ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE team_members ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE championships ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE seasons ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE match_formats ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE matches ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE sets ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE substitutions ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE score_points ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE player_stats ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE events ALTER COLUMN created_at SET DEFAULT now();
