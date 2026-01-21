-- Migration: Create subscription system functions
-- Description: Functions for checking limits and managing subscriptions

-- Function: Get user's effective team limit
-- Returns the total team slots available (base tier limit + purchased slots)
CREATE OR REPLACE FUNCTION get_user_team_limit(p_user_id uuid)
RETURNS integer AS $$
DECLARE
  v_tier subscription_tier;
  v_status subscription_status;
  v_base_limit integer;
  v_extra_slots integer;
BEGIN
  -- Get subscription tier and status
  SELECT tier, status INTO v_tier, v_status
  FROM subscriptions
  WHERE user_id = p_user_id;

  -- Set base limit based on tier (only if subscription is active/trialing)
  IF v_status IN ('active', 'trialing') THEN
    v_base_limit := CASE v_tier
      WHEN 'max' THEN 999999  -- Effectively unlimited
      WHEN 'premium' THEN 2
      ELSE 1  -- Free tier
    END;
  ELSE
    v_base_limit := 1;  -- Default to free tier if no active subscription
  END IF;

  -- Add purchased team slots (only active ones, not paused)
  SELECT COALESCE(SUM(quantity - quantity_used), 0) INTO v_extra_slots
  FROM entitlements
  WHERE user_id = p_user_id
    AND type = 'team_slot'
    AND status = 'active';

  RETURN v_base_limit + v_extra_slots;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get user's available match credits
-- Returns the number of matches the user can still create
CREATE OR REPLACE FUNCTION get_user_match_credits(p_user_id uuid)
RETURNS integer AS $$
DECLARE
  v_tier subscription_tier;
  v_status subscription_status;
  v_matches_used integer;
  v_pack_credits integer;
  v_free_matches_limit integer := 3;  -- Free tier lifetime limit
BEGIN
  -- Get subscription info
  SELECT tier, status INTO v_tier, v_status
  FROM subscriptions
  WHERE user_id = p_user_id;

  -- Premium/Max with active subscription = unlimited
  IF v_tier IN ('premium', 'max') AND v_status IN ('active', 'trialing') THEN
    RETURN 999999;
  END IF;

  -- Get matches used
  SELECT COALESCE(total_matches_count, 0) INTO v_matches_used
  FROM usage_tracking
  WHERE user_id = p_user_id;

  -- Calculate remaining free matches
  DECLARE
    v_free_remaining integer;
  BEGIN
    v_free_remaining := GREATEST(0, v_free_matches_limit - v_matches_used);

    -- Calculate remaining pack credits (only active, not paused)
    SELECT COALESCE(SUM(quantity - quantity_used), 0) INTO v_pack_credits
    FROM entitlements
    WHERE user_id = p_user_id
      AND type = 'match_pack'
      AND status = 'active';

    RETURN v_free_remaining + v_pack_credits;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Check if user can create team (active status only)
CREATE OR REPLACE FUNCTION can_create_team(p_user_id uuid)
RETURNS boolean AS $$
DECLARE
  v_current_active integer;
  v_limit integer;
BEGIN
  -- Count active teams only (exclude incomplete and archived)
  SELECT COALESCE(active_teams_count, 0) INTO v_current_active
  FROM usage_tracking
  WHERE user_id = p_user_id;

  -- If no usage record, count manually
  IF v_current_active IS NULL THEN
    SELECT COUNT(*) INTO v_current_active
    FROM teams
    WHERE user_id = p_user_id AND status = 'active';
  END IF;

  v_limit := get_user_team_limit(p_user_id);

  RETURN v_current_active < v_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Check if user can create match
CREATE OR REPLACE FUNCTION can_create_match(p_user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN get_user_match_credits(p_user_id) > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get user's full limits info (for API)
CREATE OR REPLACE FUNCTION get_user_limits(p_user_id uuid)
RETURNS json AS $$
DECLARE
  v_tier subscription_tier;
  v_status subscription_status;
  v_team_limit integer;
  v_teams_used integer;
  v_match_credits integer;
  v_matches_used integer;
  v_trial_end timestamptz;
BEGIN
  -- Get subscription info
  SELECT tier, status, trial_end INTO v_tier, v_status, v_trial_end
  FROM subscriptions
  WHERE user_id = p_user_id;

  -- Default to free if no subscription
  IF v_tier IS NULL THEN
    v_tier := 'free';
    v_status := 'active';
  END IF;

  -- Get limits and usage
  v_team_limit := get_user_team_limit(p_user_id);
  v_match_credits := get_user_match_credits(p_user_id);

  SELECT COALESCE(active_teams_count, 0), COALESCE(total_matches_count, 0)
  INTO v_teams_used, v_matches_used
  FROM usage_tracking
  WHERE user_id = p_user_id;

  RETURN json_build_object(
    'tier', v_tier,
    'status', v_status,
    'teamLimit', v_team_limit,
    'teamsUsed', COALESCE(v_teams_used, 0),
    'canCreateTeam', can_create_team(p_user_id),
    'matchCredits', v_match_credits,
    'matchesUsed', COALESCE(v_matches_used, 0),
    'canCreateMatch', can_create_match(p_user_id),
    'trialEnd', v_trial_end,
    'isTrialing', v_status = 'trialing'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Pause entitlements when user upgrades to premium/max
CREATE OR REPLACE FUNCTION pause_user_entitlements(p_user_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE entitlements
  SET status = 'paused', updated_at = now()
  WHERE user_id = p_user_id
    AND status = 'active'
    AND quantity_used < quantity;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Resume entitlements when user downgrades
CREATE OR REPLACE FUNCTION resume_user_entitlements(p_user_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE entitlements
  SET status = 'active', updated_at = now()
  WHERE user_id = p_user_id
    AND status = 'paused';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Consume match credit from pack (FIFO - oldest first)
CREATE OR REPLACE FUNCTION consume_match_credit(p_user_id uuid)
RETURNS boolean AS $$
DECLARE
  v_entitlement_id uuid;
BEGIN
  -- Find oldest available pack
  SELECT id INTO v_entitlement_id
  FROM entitlements
  WHERE user_id = p_user_id
    AND type = 'match_pack'
    AND status = 'active'
    AND quantity_used < quantity
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_entitlement_id IS NULL THEN
    RETURN false;
  END IF;

  -- Consume one credit
  UPDATE entitlements
  SET
    quantity_used = quantity_used + 1,
    status = CASE
      WHEN quantity_used + 1 >= quantity THEN 'exhausted'::entitlement_status
      ELSE 'active'::entitlement_status
    END,
    updated_at = now()
  WHERE id = v_entitlement_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Initialize subscription for new user (called on signup)
CREATE OR REPLACE FUNCTION initialize_user_subscription(p_user_id uuid)
RETURNS void AS $$
BEGIN
  -- Create subscription with 7-day premium trial
  INSERT INTO subscriptions (user_id, tier, status, trial_start, trial_end)
  VALUES (p_user_id, 'premium', 'trialing', now(), now() + interval '7 days')
  ON CONFLICT (user_id) DO NOTHING;

  -- Create usage tracking record
  INSERT INTO usage_tracking (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Handle trial expiry (to be called by cron/scheduled function)
CREATE OR REPLACE FUNCTION expire_trials()
RETURNS integer AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE subscriptions
  SET tier = 'free', status = 'active', updated_at = now()
  WHERE status = 'trialing' AND trial_end < now();

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Resume any paused entitlements for downgraded users
  UPDATE entitlements e
  SET status = 'active', updated_at = now()
  FROM subscriptions s
  WHERE e.user_id = s.user_id
    AND e.status = 'paused'
    AND s.tier = 'free';

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
