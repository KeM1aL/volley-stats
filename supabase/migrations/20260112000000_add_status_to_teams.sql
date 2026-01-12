-- Add status column to teams table
-- This migration adds a status field to track team completion status
-- Status values: incomplete, active, archived

-- Create enum type for team status
CREATE TYPE team_status AS ENUM ('incomplete', 'active', 'archived');

-- Add status column using the enum type
ALTER TABLE teams
ADD COLUMN status team_status DEFAULT 'incomplete' NOT NULL;

-- Update existing teams to incomplete status (already handled by default)
-- But we'll be explicit for clarity
UPDATE teams SET status = 'incomplete' WHERE status IS NULL;

-- Create index on status for filtering
CREATE INDEX IF NOT EXISTS teams_status_idx ON teams(status);

-- Add comment to status column for documentation
COMMENT ON COLUMN teams.status IS 'Team completion status: incomplete (quick-created or missing details), active (complete and in use), archived (old/inactive)';
