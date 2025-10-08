-- POST-V2 ROLLUP: Comprehensive Auth Mapping Fix
-- Timestamp: 20260101000006 (runs AFTER all v2 migrations)
--
-- This is the SINGLE SOURCE OF TRUTH for auth.uid() to profiles.id mapping
-- Supersedes all previous attempts including:
-- - 20251002132850, 20251006165834, 20251006171257, 20260101000005
-- - 20250919161105 (bad leaderboard join)
--
-- CANONICAL RULE: league_members.user_id = profiles.id (NOT auth.uid())

-- Drop all existing function variants
DROP FUNCTION IF EXISTS public.get_active_game_for_league(uuid);
DROP FUNCTION IF EXISTS public.set_player_base(uuid, uuid);
DROP FUNCTION IF EXISTS public.get_game_overview(uuid);
DROP FUNCTION IF EXISTS public.get_game_overview(uuid, uuid);

-- =============================================================================
-- 1. get_active_game_for_league
-- =============================================================================
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
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error','Not authenticated');
  END IF;

  -- Map auth.uid() to profiles.id
  SELECT id INTO v_profile_id FROM public.profiles WHERE user_id = v_uid;
  IF v_profile_id IS NULL THEN
    RETURN jsonb_build_object('error','User profile not found');
  END IF;

  -- Check membership using profile_id
  IF NOT EXISTS (
    SELECT 1 FROM public.league_members lm
    WHERE lm.league_id = p_league_id
      AND lm.user_id = v_profile_id
      AND lm.status = 'approved'
  ) THEN
    RETURN jsonb_build_object('error','Access denied to league');
  END IF;

  SELECT g1.* INTO g FROM public.games g1
  WHERE g1.league_id = p_league_id AND g1.status IN ('active','setup')
  ORDER BY COALESCE(g1.start_date, g1.created_at) DESC LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('game', null);
  END IF;

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

-- =============================================================================
-- 2. set_player_base
-- =============================================================================
CREATE FUNCTION public.set_player_base(p_game_id uuid, p_activity_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid;
  v_profile_id uuid;
  ua_row record;
  base_record record;
  member_count integer;
  players_with_bases integer;
  v_base_territory geometry(Polygon, 4326);
  v_base_point geometry(Point, 4326);
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Map auth.uid() to profiles.id
  SELECT id INTO v_profile_id FROM public.profiles WHERE user_id = v_uid;
  IF v_profile_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User profile not found');
  END IF;

  -- Get activity using profile_id
  SELECT ua.id, ua.user_id, ua.route, ua.polyline, ua.name, ua.start_date INTO ua_row
  FROM public.user_activities ua
  WHERE ua.id = p_activity_id AND ua.user_id = v_profile_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Activity not found or not owned by user');
  END IF;

  -- Check membership using profile_id
  IF NOT EXISTS (
    SELECT 1 FROM public.games g
    JOIN public.league_members lm ON g.league_id = lm.league_id
    WHERE g.id = p_game_id AND lm.user_id = v_profile_id AND lm.status = 'approved'
  ) THEN
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

  SELECT COUNT(*) INTO member_count
  FROM public.league_members lm JOIN public.games g ON g.league_id = lm.league_id
  WHERE g.id = p_game_id AND lm.status = 'approved';

  SELECT COUNT(DISTINCT user_id) INTO players_with_bases
  FROM public.player_bases WHERE game_id = p_game_id;

  IF players_with_bases >= member_count AND member_count >= 2 THEN
    UPDATE public.games SET status = 'active', activated_at = NOW()
    WHERE id = p_game_id AND status = 'setup';
  END IF;

  RETURN json_build_object(
    'success', true, 'base_id', base_record.id,
    'activation_result', json_build_object(
      'players_with_bases', players_with_bases, 'member_count', member_count,
      'activated', (players_with_bases >= member_count AND member_count >= 2)
    )
  );
END;
$$;

-- =============================================================================
-- 3. get_game_overview (with FIXED leaderboard join)
-- =============================================================================
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
  base_count integer := 0;
  leaderboard_data jsonb;
BEGIN
  v_uid := auth.uid();

  -- Map auth.uid() to profiles.id if authenticated
  IF v_uid IS NOT NULL THEN
    SELECT id INTO v_profile_id FROM public.profiles WHERE user_id = v_uid;
  END IF;

  -- Get game information
  SELECT g.* INTO game_info FROM public.games g WHERE g.id = p_game_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Game not found');
  END IF;

  -- Check access using profile_id (NOT v_uid!)
  IF v_uid IS NOT NULL AND v_profile_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.league_members lm
      WHERE lm.league_id = game_info.league_id
        AND lm.user_id = v_profile_id
        AND lm.status = 'approved'
    ) THEN
      RETURN jsonb_build_object('error', 'Access denied to game');
    END IF;
  END IF;

  SELECT COUNT(*) INTO member_count
  FROM public.league_members
  WHERE league_id = game_info.league_id AND status = 'approved';

  SELECT COUNT(*) INTO base_count
  FROM public.player_bases
  WHERE game_id = p_game_id;

  -- FIXED leaderboard join: pb.user_id = p.id (not p.user_id!)
  WITH leaderboard_query AS (
    SELECT
      pb.user_id,
      COALESCE(p.username, p.display_name, 'Unknown Player') as username,
      0.0 as area_km2,
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
  ) INTO leaderboard_data
  FROM leaderboard_query;

  RETURN jsonb_build_object(
    'meta', jsonb_build_object(
      'id', game_info.id,
      'name', game_info.name,
      'status', game_info.status,
      'duration_days', game_info.duration_days,
      'start_date', game_info.start_date,
      'end_date', game_info.end_date,
      'activated_at', game_info.activated_at,
      'created_at', game_info.created_at,
      'member_count', member_count,
      'bases_set', base_count
    ),
    'leaderboard', COALESCE(leaderboard_data, '[]'::jsonb)
  );
END;
$$;

-- =============================================================================
-- Security Grants
-- =============================================================================
REVOKE ALL ON FUNCTION public.get_active_game_for_league(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_active_game_for_league(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.set_player_base(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_player_base(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.get_game_overview(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_game_overview(uuid) TO authenticated;

-- =============================================================================
-- Comments (for future reference)
-- =============================================================================
COMMENT ON FUNCTION public.get_active_game_for_league(uuid) IS
  'POST-V2 ROLLUP: Maps auth.uid() to profiles.id, checks league_members.user_id = profile_id';

COMMENT ON FUNCTION public.set_player_base(uuid, uuid) IS
  'POST-V2 ROLLUP: Maps auth.uid() to profiles.id for activity ownership and membership checks';

COMMENT ON FUNCTION public.get_game_overview(uuid) IS
  'POST-V2 ROLLUP: Fixed access check AND leaderboard join (pb.user_id = p.id)';
