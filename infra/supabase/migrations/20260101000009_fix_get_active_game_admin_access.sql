-- POST-V2 FIX: Allow league admin OR approved member for get_active_game_for_league
-- Consistent with get_game_overview fix in migration 000008

DROP FUNCTION IF EXISTS public.get_active_game_for_league(uuid);

CREATE FUNCTION public.get_active_game_for_league(p_league_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid;
  v_profile_id uuid;
  g record;
  v_end_at timestamptz;
  v_now timestamptz := now();
  v_time_left_seconds bigint := null;
  is_authorized boolean := false;
BEGIN
  -- Current user
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error','Not authenticated');
  END IF;

  -- Map auth.uid() to profiles.id
  SELECT id INTO v_profile_id FROM public.profiles WHERE user_id = v_uid;
  IF v_profile_id IS NULL THEN
    RETURN jsonb_build_object('error','User profile not found');
  END IF;

  -- Authorization: allow if user is league admin OR approved member
  SELECT TRUE INTO is_authorized
  FROM public.leagues l
  WHERE l.id = p_league_id AND l.admin_user_id = v_profile_id;

  IF NOT is_authorized THEN
    SELECT TRUE INTO is_authorized
    FROM public.league_members lm
    WHERE lm.league_id = p_league_id
      AND lm.user_id = v_profile_id
      AND lm.status = 'approved';
  END IF;

  IF NOT is_authorized THEN
    RETURN jsonb_build_object('error','Access denied to league');
  END IF;

  -- Get newest game in 'active' or 'setup' status
  SELECT g1.* INTO g FROM public.games g1
  WHERE g1.league_id = p_league_id AND g1.status IN ('active','setup')
  ORDER BY COALESCE(g1.start_date, g1.created_at) DESC LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('game', null);
  END IF;

  -- Calculate end time and time remaining
  IF g.duration_days IS NOT NULL AND g.start_date IS NOT NULL THEN
    v_end_at := g.start_date + (g.duration_days || ' days')::interval;
    v_time_left_seconds := GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (v_end_at - v_now)))::bigint);
  END IF;

  RETURN jsonb_build_object(
    'game', jsonb_build_object(
      'id', g.id, 'name', g.name, 'status', g.status,
      'start_date', g.start_date, 'duration_days', g.duration_days,
      'end_at', v_end_at, 'time_left_seconds', v_time_left_seconds
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_active_game_for_league(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_active_game_for_league(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_active_game_for_league(uuid) IS
  'POST-V2 FIX: Grants access to league admin OR approved member; maps auth.uid() to profiles.id';
