-- Add score context to events table for timeline reconstruction
-- This allows tracking what the score was when an event occurred

ALTER TABLE events
ADD COLUMN home_score INTEGER,
ADD COLUMN away_score INTEGER,
ADD COLUMN point_number INTEGER;

-- Add comment for documentation
COMMENT ON COLUMN events.home_score IS 'Home team score at the time of the event';
COMMENT ON COLUMN events.away_score IS 'Away team score at the time of the event';
COMMENT ON COLUMN events.point_number IS 'Point number in the set when the event occurred';

-- Create index for efficient timeline queries with score filtering
CREATE INDEX idx_events_score_context ON events(match_id, set_id, point_number) WHERE point_number IS NOT NULL;
