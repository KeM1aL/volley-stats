-- Offline sync reliability (docs/superpowers/specs/2026-10-07-offline-sync-reliability-design.md, section 1).

-- The x-device-id header sent by the app's sync code; NULL for every other request.
-- Guard against empty string: pooled connections keep request.headers = '' after a PostgREST request.
CREATE OR REPLACE FUNCTION public.request_device_id()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT nullif(nullif(current_setting('request.headers', true), '')::json ->> 'x-device-id', '')
$$;

-- 1. _modified: server-clock replication checkpoint, set on every insert and update.
--    Not part of the app's local schemas.
CREATE OR REPLACE FUNCTION public.set_modified_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW._modified = now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'clubs', 'club_members', 'teams', 'team_members', 'championships', 'seasons',
    'match_formats', 'matches', 'sets', 'score_points', 'player_stats', 'events'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS _modified timestamptz NOT NULL DEFAULT now()', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (_modified, id)', t || '_modified_id_idx', t);
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', 'set_' || t || '_modified', t);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_modified_column()',
      'set_' || t || '_modified', t
    );
  END LOOP;
END $$;

-- 2. updated_at = time of the last edit. Sync requests (x-device-id) send the device's
--    edit time and the server keeps it; other requests (API layer) get the server time.
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF public.request_device_id() IS NULL THEN
    NEW.updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

-- 3. Scoring device per match.
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS scorer_device_id text,
  ADD COLUMN IF NOT EXISTS scorer_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS scorer_name text,
  ADD COLUMN IF NOT EXISTS scorer_device_label text,
  ADD COLUMN IF NOT EXISTS scorer_claimed_at timestamptz;

CREATE INDEX IF NOT EXISTS matches_scorer_user_id_idx ON public.matches (scorer_user_id);

CREATE OR REPLACE FUNCTION public.get_match_scorer(p_match_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'scorer_device_id', m.scorer_device_id,
    'scorer_user_id', m.scorer_user_id,
    'scorer_name', m.scorer_name,
    'scorer_device_label', m.scorer_device_label,
    'scorer_claimed_at', m.scorer_claimed_at,
    'last_activity_at', greatest(
      m._modified,
      (SELECT max(s._modified) FROM public.sets s WHERE s.match_id = m.id),
      (SELECT max(p._modified) FROM public.score_points p WHERE p.match_id = m.id),
      (SELECT max(ps._modified) FROM public.player_stats ps WHERE ps.match_id = m.id),
      (SELECT max(e._modified) FROM public.events e WHERE e.match_id = m.id)
    )
  )
  FROM public.matches m
  WHERE m.id = p_match_id
$$;

CREATE OR REPLACE FUNCTION public.claim_match_scorer(
  p_match_id uuid,
  p_device_id text,
  p_label text,
  p_force boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_current text;
  v_name text;
BEGIN
  SELECT m.scorer_device_id INTO v_current FROM public.matches m WHERE m.id = p_match_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'match_not_found';
  END IF;

  IF v_current IS NULL OR v_current = p_device_id OR p_force THEN
    -- Profiles are only readable by their owner, so the name is stored on the match.
    SELECT nullif(trim(concat_ws(' ', p.first_name, p.last_name)), '')
      INTO v_name
      FROM public.profiles p
     WHERE p.id = auth.uid();
    UPDATE public.matches
       SET scorer_device_id = p_device_id,
           scorer_user_id = auth.uid(),
           scorer_name = v_name,
           scorer_device_label = p_label,
           scorer_claimed_at = now()
     WHERE id = p_match_id;
    RETURN jsonb_build_object('claimed', true) || public.get_match_scorer(p_match_id);
  END IF;

  RETURN jsonb_build_object('claimed', false) || public.get_match_scorer(p_match_id);
END;
$$;

REVOKE ALL ON FUNCTION public.get_match_scorer(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.claim_match_scorer(uuid, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_match_scorer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_match_scorer(uuid, text, text, boolean) TO authenticated;

-- 4. Only the scoring device may write a claimed match's data (sync requests only).
CREATE OR REPLACE FUNCTION public.enforce_match_scorer()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_device text := public.request_device_id();
  v_scorer text;
BEGIN
  IF v_device IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_TABLE_NAME = 'matches' THEN
    IF NEW.scorer_device_id IS DISTINCT FROM OLD.scorer_device_id THEN
      RETURN NEW; -- a claim (claim_match_scorer)
    END IF;
    v_scorer := OLD.scorer_device_id;
  ELSE
    SELECT m.scorer_device_id INTO v_scorer FROM public.matches m WHERE m.id = NEW.match_id;
  END IF;
  IF v_scorer IS NOT NULL AND v_scorer <> v_device THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'scorer_mismatch';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_matches_scorer ON public.matches;
CREATE TRIGGER enforce_matches_scorer
  BEFORE UPDATE ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.enforce_match_scorer();

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['sets', 'score_points', 'player_stats', 'events'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', 'enforce_' || t || '_scorer', t);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.enforce_match_scorer()',
      'enforce_' || t || '_scorer', t
    );
  END LOOP;
END $$;
