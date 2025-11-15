-- Migration: Drop substitutions table
-- All substitutions have been migrated to events table
-- Going forward, only events table will be used

-- Drop the substitutions table
DROP TABLE IF EXISTS substitutions CASCADE;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Substitutions table dropped successfully. All data migrated to events table.';
END $$;
