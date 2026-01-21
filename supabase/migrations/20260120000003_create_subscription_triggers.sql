-- Migration: Create subscription system triggers
-- Description: Triggers for automatic usage tracking

-- Trigger function: Update active teams count when team status changes
CREATE OR REPLACE FUNCTION update_team_usage()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Determine which user_id to use
  v_user_id := COALESCE(NEW.user_id, OLD.user_id);

  -- Ensure usage tracking record exists
  INSERT INTO usage_tracking (user_id, active_teams_count, total_matches_count)
  VALUES (v_user_id, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  IF TG_OP = 'INSERT' THEN
    -- Only count if new team is active
    IF NEW.status = 'active' THEN
      UPDATE usage_tracking
      SET active_teams_count = active_teams_count + 1, updated_at = now()
      WHERE user_id = NEW.user_id;
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    -- Status changed to active
    IF OLD.status != 'active' AND NEW.status = 'active' THEN
      UPDATE usage_tracking
      SET active_teams_count = active_teams_count + 1, updated_at = now()
      WHERE user_id = NEW.user_id;
    -- Status changed from active to something else
    ELSIF OLD.status = 'active' AND NEW.status != 'active' THEN
      UPDATE usage_tracking
      SET active_teams_count = GREATEST(0, active_teams_count - 1), updated_at = now()
      WHERE user_id = NEW.user_id;
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    -- Only decrement if deleted team was active
    IF OLD.status = 'active' THEN
      UPDATE usage_tracking
      SET active_teams_count = GREATEST(0, active_teams_count - 1), updated_at = now()
      WHERE user_id = OLD.user_id;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on teams table
DROP TRIGGER IF EXISTS teams_usage_trigger ON teams;
CREATE TRIGGER teams_usage_trigger
  AFTER INSERT OR UPDATE OF status OR DELETE ON teams
  FOR EACH ROW EXECUTE FUNCTION update_team_usage();

-- Trigger function: Track match creation and consume credits if needed
CREATE OR REPLACE FUNCTION track_match_creation()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id uuid;
  v_tier subscription_tier;
  v_status subscription_status;
  v_matches_used integer;
  v_free_limit integer := 3;
BEGIN
  -- Get user_id from home team
  SELECT user_id INTO v_user_id FROM teams WHERE id = NEW.home_team_id;

  IF v_user_id IS NULL THEN
    -- Fallback: try away team
    SELECT user_id INTO v_user_id FROM teams WHERE id = NEW.away_team_id;
  END IF;

  IF v_user_id IS NULL THEN
    RETURN NEW;  -- Can't track without user
  END IF;

  -- Ensure usage tracking record exists
  INSERT INTO usage_tracking (user_id, active_teams_count, total_matches_count)
  VALUES (v_user_id, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  -- Get subscription info
  SELECT tier, status INTO v_tier, v_status
  FROM subscriptions
  WHERE user_id = v_user_id;

  -- Get current match count before incrementing
  SELECT total_matches_count INTO v_matches_used
  FROM usage_tracking
  WHERE user_id = v_user_id;

  -- Update usage tracking
  UPDATE usage_tracking
  SET
    total_matches_count = total_matches_count + 1,
    updated_at = now()
  WHERE user_id = v_user_id;

  -- If free tier user and beyond free limit, consume from pack
  IF (v_tier = 'free' OR v_tier IS NULL OR v_status NOT IN ('active', 'trialing')) THEN
    IF v_matches_used >= v_free_limit THEN
      -- Try to consume from match pack
      PERFORM consume_match_credit(v_user_id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on matches table
DROP TRIGGER IF EXISTS matches_creation_trigger ON matches;
CREATE TRIGGER matches_creation_trigger
  AFTER INSERT ON matches
  FOR EACH ROW EXECUTE FUNCTION track_match_creation();

-- Trigger function: Handle subscription tier changes (pause/resume entitlements)
CREATE OR REPLACE FUNCTION handle_subscription_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Upgrading to premium/max: pause entitlements
  IF NEW.tier IN ('premium', 'max') AND NEW.status IN ('active', 'trialing') THEN
    IF OLD.tier = 'free' OR OLD.status NOT IN ('active', 'trialing') THEN
      PERFORM pause_user_entitlements(NEW.user_id);
    END IF;
  -- Downgrading to free: resume entitlements
  ELSIF NEW.tier = 'free' OR NEW.status NOT IN ('active', 'trialing') THEN
    IF OLD.tier IN ('premium', 'max') AND OLD.status IN ('active', 'trialing') THEN
      PERFORM resume_user_entitlements(NEW.user_id);
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on subscriptions table
DROP TRIGGER IF EXISTS subscription_change_trigger ON subscriptions;
CREATE TRIGGER subscription_change_trigger
  AFTER UPDATE OF tier, status ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION handle_subscription_change();

-- Trigger function: Initialize subscription on new user (via auth.users)
-- Note: This may need to be set up differently depending on Supabase setup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM initialize_user_subscription(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: The trigger on auth.users needs to be created with elevated permissions
-- This should be run separately or via Supabase dashboard:
-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Initialize existing users: Create subscription and usage records for users who don't have them
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT id FROM auth.users
    WHERE id NOT IN (SELECT user_id FROM subscriptions)
  LOOP
    -- Create subscription (free tier for existing users, no trial)
    INSERT INTO subscriptions (user_id, tier, status)
    VALUES (r.id, 'free', 'active')
    ON CONFLICT (user_id) DO NOTHING;

    -- Create usage tracking
    INSERT INTO usage_tracking (user_id)
    VALUES (r.id)
    ON CONFLICT (user_id) DO NOTHING;
  END LOOP;
END;
$$;

-- Sync existing team counts
UPDATE usage_tracking ut
SET active_teams_count = (
  SELECT COUNT(*)
  FROM teams t
  WHERE t.user_id = ut.user_id AND t.status = 'active'
);

-- Sync existing match counts
UPDATE usage_tracking ut
SET total_matches_count = (
  SELECT COUNT(*)
  FROM matches m
  JOIN teams t ON m.home_team_id = t.id
  WHERE t.user_id = ut.user_id
);
