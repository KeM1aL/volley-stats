-- Migration: Add point_number to score_points
-- This migration adds a sequential point_number field for reliable point ordering
-- Point number increments by 1 for each point in a set, regardless of scoring team

-- Add point_number column
ALTER TABLE score_points
ADD COLUMN point_number INTEGER;

-- For existing records, calculate point_number based on created_at order
-- This assumes created_at reflects the correct point order
UPDATE score_points
SET point_number = home_score + away_score;

-- Make point_number NOT NULL after backfilling
ALTER TABLE score_points
ALTER COLUMN point_number SET NOT NULL;

-- Add index for efficient sorting by set and point number
CREATE INDEX idx_score_points_set_point_number
ON score_points(set_id, point_number);