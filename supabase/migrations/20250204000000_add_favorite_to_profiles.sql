-- Add favorite fields to profiles table (only one will be set at a time)
ALTER TABLE profiles
  ADD COLUMN favorite_team_id uuid REFERENCES teams(id) ON DELETE SET NULL,
  ADD COLUMN favorite_club_id uuid REFERENCES clubs(id) ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX idx_profiles_favorite_team ON profiles(favorite_team_id);
CREATE INDEX idx_profiles_favorite_club ON profiles(favorite_club_id);

-- Add check constraint to ensure only one favorite is set
ALTER TABLE profiles
  ADD CONSTRAINT chk_only_one_favorite
  CHECK (
    (favorite_team_id IS NOT NULL AND favorite_club_id IS NULL) OR
    (favorite_team_id IS NULL AND favorite_club_id IS NOT NULL) OR
    (favorite_team_id IS NULL AND favorite_club_id IS NULL)
  );

-- Add comments
COMMENT ON COLUMN profiles.favorite_team_id IS 'User preferred team for default filtering (mutually exclusive with favorite_club_id)';
COMMENT ON COLUMN profiles.favorite_club_id IS 'User preferred club for default filtering (mutually exclusive with favorite_team_id)';
