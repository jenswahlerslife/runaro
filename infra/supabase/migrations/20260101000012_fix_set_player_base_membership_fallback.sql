-- Patch: make set_player_base tolerate legacy membership records
-- Some legacy leagues still track members exclusively in league_memberships
-- (without status information) while newer leagues use league_members with
-- status='approved'. This migration updates the function so both storage
-- patterns authorize correctly and ensures member counts fall back when
-- league_members is empty.

DROP FUNCTION IF EXISTS public.set_player_base(uuid, uuid);
CREATE FUNCTION public.set_player_base(p_game_id uuid, p_activity_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid;
  v_profile_id uuid;
  v_game record;
  ua_row record;
  base_record record;
  v_member_count integer := 0;
  players_with_bases integer := 0;
  v_base_territory geometry(Polygon, 4326);
  v_base_point geometry(Point, 4326);
  v_has_membership boolean := false;
  activation_result json := NULL;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT id INTO v_profile_id FROM public.profiles WHERE user_id = v_uid;
  IF v_profile_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User profile not found');
  END IF;

  -- Confirm activity ownership (user_activities.user_id stores profiles.id)
  SELECT ua.id, ua.user_id, ua.route, ua.polyline, ua.name, ua.start_date
  INTO ua_row
  FROM public.user_activities ua
  WHERE ua.id = p_activity_id AND ua.user_id = v_profile_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Activity not found or not owned by user');
  END IF;

  -- Load the game to retrieve the league identifier
  SELECT * INTO v_game FROM public.games g WHERE g.id = p_game_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Game not found');
  END IF;

  -- Membership check: accept either profile-id or auth.uid() across both tables
  SELECT EXISTS (
    SELECT 1
    FROM public.league_members lm
    WHERE lm.league_id = v_game.league_id
      AND lm.status = 'approved'
      AND (lm.user_id = v_profile_id OR lm.user_id = v_uid)
  ) OR EXISTS (
    SELECT 1
    FROM public.league_memberships lms
    WHERE lms.league_id = v_game.league_id
      AND (lms.user_id = v_profile_id OR lms.user_id = v_uid)
  )
  INTO v_has_membership;

  IF NOT v_has_membership THEN
    RETURN json_build_object('success', false, 'error', 'Game not found or user not authorized');
  END IF;

  IF ua_row.route IS NOT NULL THEN
    v_base_territory := ST_Buffer(ua_row.route::geography, 50)::geometry;
    v_base_point := ST_StartPoint(ua_row.route);
  ELSE
    v_base_territory := NULL;
    v_base_point := NULL;
  END IF;

  INSERT INTO public.player_bases (game_id, user_id, activity_id, base_territory, base_point)
  VALUES (p_game_id, v_profile_id, p_activity_id, v_base_territory, v_base_point)
  ON CONFLICT (game_id, user_id)
  DO UPDATE SET
    activity_id = EXCLUDED.activity_id,
    base_territory = EXCLUDED.base_territory,
    base_point = EXCLUDED.base_point,
    updated_at = NOW()
  RETURNING * INTO base_record;

  -- Member counts and activation are handled via maybe_activate_game to keep logic consistent
  SELECT public.maybe_activate_game(p_game_id) INTO activation_result;

  -- Derive counts locally in case maybe_activate_game returned NULL or errored internally
  BEGIN
    SELECT COUNT(*) INTO v_member_count
    FROM public.league_members lm
    WHERE lm.league_id = v_game.league_id
      AND lm.status = 'approved';

    IF v_member_count = 0 THEN
      SELECT COUNT(*) INTO v_member_count
      FROM public.league_memberships lms
      WHERE lms.league_id = v_game.league_id;
    END IF;

    SELECT COUNT(DISTINCT user_id) INTO players_with_bases
    FROM public.player_bases
    WHERE game_id = p_game_id;
  EXCEPTION WHEN others THEN
    -- ignore count errors; rely on activation_result payload if available
    NULL;
  END;

  RETURN json_build_object(
    'success', true,
    'base_id', base_record.id,
    'activation_result', COALESCE(
      activation_result,
      json_build_object(
        'players_with_bases', players_with_bases,
        'member_count', v_member_count,
        'activated', (players_with_bases >= v_member_count AND v_member_count >= 2)
      )
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_player_base(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_player_base(uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.set_player_base(uuid, uuid) IS
  'Updated to authorize via league_members or league_memberships (profile id or auth.uid) and trigger maybe_activate_game for consistent auto-activation';

-- ---------------------------------------------------------------------------
-- Update maybe_activate_game to share the same dual-table membership logic
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.maybe_activate_game(uuid);
CREATE FUNCTION public.maybe_activate_game(p_game_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  game_record record;
  member_count integer := 0;
  players_with_bases integer := 0;
  can_activate boolean := false;
  start_ts timestamptz;
  end_ts timestamptz;
BEGIN
  SELECT * INTO game_record FROM public.games WHERE id = p_game_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Game not found');
  END IF;

  -- Count approved members from the new table
  SELECT COUNT(*) INTO member_count
  FROM public.league_members
  WHERE league_id = game_record.league_id
    AND status = 'approved';

  -- Fallback to legacy league_memberships if necessary
  IF member_count = 0 THEN
    SELECT COUNT(*) INTO member_count
    FROM public.league_memberships
    WHERE league_id = game_record.league_id;
  END IF;

  -- Count players that have already selected a base
  SELECT COUNT(*) INTO players_with_bases
  FROM public.player_bases
  WHERE game_id = p_game_id;

  IF players_with_bases >= member_count AND member_count >= 2 THEN
    can_activate := true;
  END IF;

  IF can_activate AND game_record.status = 'setup' THEN
    start_ts := NOW();
    end_ts := start_ts + (COALESCE(game_record.duration_days, 14) || ' days')::interval;

    UPDATE public.games
    SET
      status = 'active',
      start_date = start_ts,
      end_date = end_ts,
      activated_at = NOW()
    WHERE id = p_game_id;

    RETURN json_build_object(
      'success', true,
      'activated', true,
      'member_count', member_count,
      'players_with_bases', players_with_bases,
      'start_date', start_ts,
      'end_date', end_ts,
      'status', 'active'
    );
  END IF;

  RETURN json_build_object(
    'success', true,
    'activated', false,
    'member_count', member_count,
    'players_with_bases', players_with_bases,
    'status', game_record.status,
    'start_date', game_record.start_date,
    'end_date', game_record.end_date
  );
END;
$$;

REVOKE ALL ON FUNCTION public.maybe_activate_game(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.maybe_activate_game(uuid) TO authenticated;

COMMENT ON FUNCTION public.maybe_activate_game(uuid) IS
  'Auto-activates games when all members (league_members or legacy league_memberships) have bases, setting start/end timestamps consistently.';

-- ---------------------------------------------------------------------------
-- Refresh get_game_overview to align with dual membership logic and deliver
-- countdown + member/base counts in the structure expected by the frontend
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_game_overview(uuid);
CREATE FUNCTION public.get_game_overview(p_game_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid;
  v_profile_id uuid;
  game_info record;
  member_count integer := 0;
  legacy_member_count integer := 0;
  base_count integer := 0;
  leaderboard_data jsonb;
  is_authorized boolean := false;
  time_left integer := NULL;
  effective_member_count integer := 0;
BEGIN
  v_uid := auth.uid();

  IF v_uid IS NOT NULL THEN
    SELECT id INTO v_profile_id FROM public.profiles WHERE user_id = v_uid;
  END IF;

  SELECT g.* INTO game_info FROM public.games g WHERE g.id = p_game_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Game not found');
  END IF;

  -- Authorization: allow admins or approved members
  IF v_profile_id IS NOT NULL THEN
    SELECT TRUE INTO is_authorized
    FROM public.leagues l
    WHERE l.id = game_info.league_id AND l.admin_user_id = v_profile_id;

    IF NOT is_authorized THEN
      SELECT TRUE INTO is_authorized
      FROM public.league_members lm
      WHERE lm.league_id = game_info.league_id
        AND lm.user_id = v_profile_id
        AND lm.status = 'approved';
    END IF;

    IF NOT is_authorized THEN
      RETURN jsonb_build_object('error', 'Access denied to game');
    END IF;
  END IF;

  SELECT COUNT(*) INTO member_count
  FROM public.league_members
  WHERE league_id = game_info.league_id
    AND status = 'approved';

  SELECT COUNT(*) INTO legacy_member_count
  FROM public.league_memberships
  WHERE league_id = game_info.league_id;

  effective_member_count := CASE
    WHEN member_count > 0 THEN member_count
    ELSE legacy_member_count
  END;

  SELECT COUNT(*) INTO base_count
  FROM public.player_bases
  WHERE game_id = p_game_id;

  IF game_info.end_date IS NOT NULL THEN
    time_left := GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (game_info.end_date - NOW()))));
  ELSIF game_info.status = 'active' AND game_info.start_date IS NOT NULL THEN
    time_left := GREATEST(
      0,
      FLOOR(
        EXTRACT(
          EPOCH FROM (
            (game_info.start_date + (COALESCE(game_info.duration_days, 14) || ' days')::interval) - NOW()
          )
        )
      )
    );
  END IF;

  WITH leaderboard_query AS (
    SELECT
      pb.user_id,
      COALESCE(p.username, p.display_name, 'Unknown Player') AS username,
      0.0 AS area_km2,
      pb.created_at
    FROM public.player_bases pb
    LEFT JOIN public.profiles p ON pb.user_id = p.id
    WHERE pb.game_id = p_game_id
    ORDER BY pb.created_at ASC
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'user_id', user_id,
      'username', username,
      'area_km2', area_km2
    )
  )
  INTO leaderboard_data
  FROM leaderboard_query;

  RETURN jsonb_build_object(
    'meta', jsonb_build_object(
      'id', game_info.id,
      'league_id', game_info.league_id,
      'name', game_info.name,
      'status', game_info.status,
      'duration_days', game_info.duration_days,
      'start_date', game_info.start_date,
      'end_date', game_info.end_date,
      'activated_at', game_info.activated_at,
      'winner_user_id', game_info.winner_user_id,
      'time_left_seconds', time_left,
      'member_count', effective_member_count,
      'bases_set', base_count
    ),
    'counts', jsonb_build_object(
      'member_count', effective_member_count,
      'base_count', base_count
    ),
    'leaderboard', COALESCE(leaderboard_data, '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_game_overview(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_game_overview(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_game_overview(uuid) IS
  'Returns game metadata, member/base counts, countdown info, and leaderboard using dual-table membership logic.';
