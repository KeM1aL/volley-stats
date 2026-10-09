-- claim_match_scorer refuses a missing or blank device id (22023 invalid_device_id): a claim without
-- a device would make every later write of the match look like it comes from another scorer.
-- Same function as in 20261007000000_sync_reliability.sql, with the check added first. Signature and
-- grants are unchanged.
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
  IF p_device_id IS NULL OR btrim(p_device_id) = '' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_device_id';
  END IF;

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
