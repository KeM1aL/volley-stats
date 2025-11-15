-- Migration: Enhance events table and migrate substitutions
-- This migration:
-- 1. Updates the events table schema to support comprehensive event tracking
-- 2. Migrates existing substitutions to the events table
-- 3. Maintains backward compatibility with substitutions table

-- Step 1: Modify events table to support the new structure
-- Drop old constraints if they exist
ALTER TABLE IF EXISTS events
  DROP CONSTRAINT IF EXISTS events_team_id_fkey,
  DROP CONSTRAINT IF EXISTS events_match_id_fkey,
  DROP CONSTRAINT IF EXISTS events_set_id_fkey;

-- Alter events table structure
ALTER TABLE events
  -- Change team_id to nullable (not all events have a team)
  ALTER COLUMN team_id DROP NOT NULL,

  -- Change set_id to nullable (some events are match-level, not set-level)
  ALTER COLUMN set_id DROP NOT NULL,

  -- Drop old columns that don't fit the new model
  DROP COLUMN IF EXISTS home_score,
  DROP COLUMN IF EXISTS away_score,
  DROP COLUMN IF EXISTS comment;

-- Add new columns for the enhanced events system
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS event_type VARCHAR(50) NOT NULL DEFAULT 'comment',
  ADD COLUMN IF NOT EXISTS timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS team VARCHAR(10), -- 'home' or 'away'
  ADD COLUMN IF NOT EXISTS player_id UUID,
  ADD COLUMN IF NOT EXISTS comment TEXT, -- General comment at column level
  ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}'::jsonb;

-- Update the type column to event_type if it's not already done
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'type') THEN
    -- Copy data from 'type' to 'event_type' if event_type is empty
    UPDATE events SET event_type = type WHERE event_type IS NULL OR event_type = '';
    -- Drop the old 'type' column
    ALTER TABLE events DROP COLUMN type;
  END IF;
END $$;

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_events_event_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_match_id_timestamp ON events(match_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_events_set_id ON events(set_id) WHERE set_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_player_id ON events(player_id) WHERE player_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_team ON events(team) WHERE team IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_details_substitution_id ON events((details->>'substitution_id')) WHERE event_type = 'substitution';

-- Add foreign key constraints
ALTER TABLE events
  ADD CONSTRAINT events_match_id_fkey FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
  ADD CONSTRAINT events_set_id_fkey FOREIGN KEY (set_id) REFERENCES sets(id) ON DELETE CASCADE,
  ADD CONSTRAINT events_player_id_fkey FOREIGN KEY (player_id) REFERENCES team_members(id) ON DELETE SET NULL,
  ADD CONSTRAINT events_team_id_fkey FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL;

-- Add check constraint for event_type
ALTER TABLE events
  DROP CONSTRAINT IF EXISTS events_event_type_check;

ALTER TABLE events
  ADD CONSTRAINT events_event_type_check
  CHECK (event_type IN ('substitution', 'timeout', 'injury', 'sanction', 'technical', 'comment'));

-- Add check constraint for team field
ALTER TABLE events
  DROP CONSTRAINT IF EXISTS events_team_check;

ALTER TABLE events
  ADD CONSTRAINT events_team_check
  CHECK (team IS NULL OR team IN ('home', 'away'));

-- Step 2: Migrate existing substitutions to events table
INSERT INTO events (
  id,
  match_id,
  set_id,
  team_id,
  event_type,
  timestamp,
  team,
  player_id,
  details,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid() as id,
  s.match_id,
  s.set_id,
  s.team_id,
  'substitution' as event_type,
  COALESCE(s.timestamp::timestamptz, s.created_at) as timestamp,
  -- Determine if home or away team based on match
  CASE
    WHEN s.team_id = m.home_team_id THEN 'home'
    WHEN s.team_id = m.away_team_id THEN 'away'
    ELSE NULL
  END as team,
  s.player_in_id as player_id, -- Use player_in as the primary player
  jsonb_build_object(
    'player_in_id', s.player_in_id,
    'player_out_id', s.player_out_id,
    'position', s.position,
    'comments', COALESCE(s.comments, ''),
    'substitution_id', s.id::text,  -- Keep reference to original substitution
    'migrated', true
  ) as details,
  s.created_at,
  COALESCE(s.updated_at, s.created_at) as updated_at
FROM substitutions s
JOIN matches m ON s.match_id = m.id
WHERE NOT EXISTS (
  -- Avoid duplicates if migration runs multiple times
  SELECT 1 FROM events e
  WHERE e.details->>'substitution_id' = s.id::text
    AND e.event_type = 'substitution'
);

-- Step 3: Add comment explaining the migration
COMMENT ON TABLE events IS 'Unified events table tracking all match events including substitutions, timeouts, injuries, sanctions, technical issues, and comments. Substitutions migrated from substitutions table.';
COMMENT ON COLUMN events.event_type IS 'Type of event: substitution, timeout, injury, sanction, technical, comment';
COMMENT ON COLUMN events.details IS 'JSON object containing event-specific details. For substitutions: {player_in_id, player_out_id, position, comments, substitution_id}';
COMMENT ON COLUMN events.team IS 'Which team the event relates to: home or away. Can be null for match-level events.';

-- Grant necessary permissions (adjust as needed for your RLS policies)
-- Note: Update these based on your specific RLS requirements
-- GRANT SELECT, INSERT, UPDATE, DELETE ON events TO authenticated;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Events table enhanced and substitutions migrated successfully';
END $$;
