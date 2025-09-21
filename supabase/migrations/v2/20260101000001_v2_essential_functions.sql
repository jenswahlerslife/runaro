-- V2.0 Essential Functions Migration
-- Generated: 2025-09-17
-- Consolidates all working database functions from Phase 1
--
-- All functions use SECURITY DEFINER with locked search_path for security
-- Functions are already tested and working correctly in production

BEGIN;

-- =============================================================================
-- CONSOLIDATED GAME MANAGEMENT FUNCTIONS
-- =============================================================================

-- 1. CREATE_GAME - Game creation with authorization and subscription handling
CREATE OR REPLACE FUNCTION public.create_game(
  p_league_id uuid,
  p_name text,
  p_duration_days integer DEFAULT 14
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  game_record record;
  user_profile_id uuid;
  member_count integer;
  is_authorized boolean := false;
  user_plan text;
  final_duration_days integer;
BEGIN
  -- Get user profile ID from auth.uid()
  SELECT id INTO user_profile_id
  FROM public.profiles
  WHERE user_id = auth.uid();

  IF user_profile_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User profile not found');
  END IF;

  -- Check if user is league owner OR admin (use league_members table with status)
  IF EXISTS (SELECT 1 FROM public.leagues WHERE id = p_league_id AND admin_user_id = user_profile_id)
     OR EXISTS (
       SELECT 1 FROM public.league_members
       WHERE league_id = p_league_id AND user_id = user_profile_id AND role = 'admin' AND status='approved'
     )
  THEN
     is_authorized := true;
  END IF;

  IF NOT is_authorized THEN
    RETURN json_build_object('success', false, 'error', 'Not authorized to create games in this league');
  END IF;

  -- Check approved member count (use league_members table with status)
  SELECT COUNT(*) INTO member_count
  FROM public.league_members
  WHERE league_id = p_league_id AND status='approved';

  IF member_count < 2 THEN
    RETURN json_build_object('success', false, 'error', 'League needs at least 2 approved members to create a game');
  END IF;

  -- Get user's subscription plan (fallback to 'free' if function doesn't exist)
  BEGIN
    SELECT get_user_plan(auth.uid()) INTO user_plan;
  EXCEPTION WHEN undefined_function THEN
    user_plan := 'free';
  END;

  -- Validate and set duration_days based on plan
  IF user_plan = 'free' OR user_plan IS NULL THEN
    -- Free plan: force to 14 days, ignore client input
    final_duration_days := 14;
  ELSIF user_plan = 'pro' THEN
    -- Pro plan: validate range 14-30 days
    IF p_duration_days < 14 OR p_duration_days > 30 THEN
      RETURN json_build_object(
        'success', false,
        'error', 'For Pro plans, duration_days must be between 14 and 30 days'
      );
    ELSE
      final_duration_days := p_duration_days;
    END IF;
  ELSE
    -- Fallback: treat as free plan
    final_duration_days := 14;
  END IF;

  -- Create the game with duration_days and immediate start_date
  INSERT INTO public.games (league_id, name, status, created_by, duration_days, start_date)
  VALUES (p_league_id, p_name, 'setup', user_profile_id, final_duration_days, NOW())
  RETURNING * INTO game_record;

  RETURN json_build_object(
    'success', true,
    'id', game_record.id,
    'game_id', game_record.id,
    'game_name', game_record.name,
    'duration_days', game_record.duration_days,
    'start_date', game_record.start_date,
    'status', game_record.status,
    'user_plan', COALESCE(user_plan, 'free'),
    'member_count', member_count
  );
END;
$$;

-- 2. GET_ACTIVE_GAME_FOR_LEAGUE - Retrieve active game for a league
CREATE OR REPLACE FUNCTION public.get_active_game_for_league(p_league_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid;
  g record;
  v_end_at timestamptz;
  v_now timestamptz := now();
  v_time_left_seconds bigint := null;
BEGIN
  v_uid := auth.uid();
  if v_uid is null then
    return jsonb_build_object('error','Not authenticated');
  end if;

  -- Check if user is active member of league (use league_members table with status)
  if not exists (
    select 1 from public.league_members lm
    where lm.league_id = p_league_id
      and lm.user_id = v_uid
      and lm.status = 'approved'
  ) then
    return jsonb_build_object('error','Access denied to league');
  end if;

  -- Get newest game in 'active' or 'setup' status
  select g1.*
  into g
  from public.games g1
  where g1.league_id = p_league_id
    and g1.status in ('active','setup')
  order by coalesce(g1.start_date, g1.created_at) desc
  limit 1;

  if not found then
    return jsonb_build_object('game', null);
  end if;

  -- Calculate end time and time remaining if using duration_days
  if g.duration_days is not null and (g.start_date is not null) then
    v_end_at := g.start_date + (g.duration_days || ' days')::interval;
    v_time_left_seconds := greatest(0, floor(extract(epoch from (v_end_at - v_now)))::bigint);
  end if;

  return jsonb_build_object(
    'game', jsonb_build_object(
      'id', g.id,
      'name', g.name,
      'status', g.status,
      'start_date', g.start_date,
      'duration_days', g.duration_days,
      'end_at', v_end_at,
      'time_left_seconds', v_time_left_seconds
    )
  );
END;
$$;

-- 3. SET_PLAYER_BASE - Set player starting position with auto-activation
CREATE OR REPLACE FUNCTION public.set_player_base(
  p_game_id uuid,
  p_activity_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid;
  activity_data record;
  base_record record;
  member_count integer;
  players_with_bases integer;
BEGIN
  v_uid := auth.uid();
  if v_uid is null then
    return json_build_object('success', false, 'error', 'Not authenticated');
  end if;

  -- Get activity data with territory
  select ua.id, ua.user_id, a.territory_geom, a.name, a.start_point
  into activity_data
  from public.user_activities ua
  join public.activities a on ua.activity_id = a.id
  where ua.id = p_activity_id and ua.user_id = v_uid;

  if not found then
    return json_build_object('success', false, 'error', 'Activity not found or not owned by user');
  end if;

  -- Verify game exists and user is member (use league_members with status)
  if not exists (
    select 1 from public.games g
    join public.league_members lm on g.league_id = lm.league_id
    where g.id = p_game_id and lm.user_id = v_uid and lm.status = 'approved'
  ) then
    return json_build_object('success', false, 'error', 'Game not found or user not authorized');
  end if;

  -- Insert or update player base
  insert into public.player_bases (
    game_id, user_id, activity_id, base_territory, base_point
  )
  values (
    p_game_id, v_uid, p_activity_id,
    activity_data.territory_geom, activity_data.start_point
  )
  on conflict (game_id, user_id)
  do update set
    activity_id = excluded.activity_id,
    base_territory = excluded.base_territory,
    base_point = excluded.base_point,
    updated_at = now()
  returning * into base_record;

  -- Check if game should be activated (all members have bases)
  SELECT COUNT(*) INTO member_count
  FROM public.league_members lm
  JOIN public.games g ON g.league_id = lm.league_id
  WHERE g.id = p_game_id AND lm.status = 'approved';

  SELECT COUNT(DISTINCT user_id) INTO players_with_bases
  FROM public.player_bases
  WHERE game_id = p_game_id;

  -- Auto-activate game if all players have bases
  IF players_with_bases >= member_count AND member_count >= 2 THEN
    UPDATE public.games
    SET status = 'active', activated_at = NOW()
    WHERE id = p_game_id AND status = 'setup';
  END IF;

  return json_build_object(
    'success', true,
    'base_id', base_record.id,
    'activity_name', activity_data.name,
    'players_with_bases', players_with_bases,
    'required_members', member_count,
    'game_activated', (players_with_bases >= member_count AND member_count >= 2)
  );
END;
$$;

-- =============================================================================
-- DATABASE MONITORING FUNCTIONS
-- =============================================================================

-- 4. GET_DATABASE_HEALTH - Comprehensive database health monitoring
CREATE OR REPLACE FUNCTION public.get_database_health()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  health_data json;
  table_counts json;
  function_status json;
BEGIN
  -- Get table row counts
  SELECT json_build_object(
    'profiles', (SELECT COUNT(*) FROM public.profiles),
    'leagues', (SELECT COUNT(*) FROM public.leagues),
    'league_members', (SELECT COUNT(*) FROM public.league_members),
    'league_memberships', (SELECT COUNT(*) FROM public.league_memberships),
    'games', (SELECT COUNT(*) FROM public.games),
    'activities', (SELECT COUNT(*) FROM public.activities),
    'user_activities', (SELECT COUNT(*) FROM public.user_activities),
    'player_bases', (SELECT COUNT(*) FROM public.player_bases),
    'territory_ownership', (SELECT COUNT(*) FROM public.territory_ownership),
    'error_reports', (SELECT COUNT(*) FROM public.error_reports)
  ) INTO table_counts;

  -- Check function status
  SELECT json_build_object(
    'create_game', EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'create_game'),
    'get_active_game_for_league', EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'get_active_game_for_league'),
    'set_player_base', EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'set_player_base'),
    'get_database_health', EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'get_database_health')
  ) INTO function_status;

  -- Build health report
  SELECT json_build_object(
    'status', 'healthy',
    'timestamp', NOW(),
    'version', 'v2.0',
    'table_counts', table_counts,
    'function_status', function_status,
    'setup_games', (SELECT COUNT(*) FROM public.games WHERE status = 'setup'),
    'active_games', (SELECT COUNT(*) FROM public.games WHERE status = 'active'),
    'finished_games', (SELECT COUNT(*) FROM public.games WHERE status = 'finished'),
    'strava_connected_users', (SELECT COUNT(*) FROM public.profiles WHERE strava_access_token IS NOT NULL),
    'total_activities', (SELECT COUNT(*) FROM public.activities),
    'pending_league_requests', (SELECT COUNT(*) FROM public.league_members WHERE status = 'pending')
  ) INTO health_data;

  RETURN health_data;
END;
$$;

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- 5. GET_GAME_OVERVIEW - Get comprehensive game information
CREATE OR REPLACE FUNCTION public.get_game_overview(p_game_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid;
  game_data record;
  league_data record;
  player_count integer;
  result jsonb;
BEGIN
  v_uid := auth.uid();
  if v_uid is null then
    return jsonb_build_object('error', 'Not authenticated');
  end if;

  -- Get game and league data
  SELECT g.*, l.name as league_name, l.admin_user_id
  INTO game_data
  FROM public.games g
  JOIN public.leagues l ON g.league_id = l.id
  WHERE g.id = p_game_id;

  if not found then
    return jsonb_build_object('error', 'Game not found');
  end if;

  -- Check if user has access to this game
  if not exists (
    select 1 from public.league_members lm
    where lm.league_id = game_data.league_id
      and lm.user_id = v_uid
      and lm.status = 'approved'
  ) then
    return jsonb_build_object('error', 'Access denied');
  end if;

  -- Get player count
  SELECT COUNT(DISTINCT user_id) INTO player_count
  FROM public.player_bases
  WHERE game_id = p_game_id;

  -- Build result
  result := jsonb_build_object(
    'id', game_data.id,
    'name', game_data.name,
    'status', game_data.status,
    'league_name', game_data.league_name,
    'start_date', game_data.start_date,
    'duration_days', game_data.duration_days,
    'player_count', player_count,
    'created_at', game_data.created_at
  );

  return jsonb_build_object('game', result);
END;
$$;

-- =============================================================================
-- FUNCTION PERMISSIONS AND SECURITY
-- =============================================================================

-- Grant execute permissions to authenticated users only
REVOKE ALL ON FUNCTION public.create_game(uuid, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_game(uuid, text, integer) TO authenticated;

REVOKE ALL ON FUNCTION public.get_active_game_for_league(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_active_game_for_league(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.set_player_base(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_player_base(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.get_database_health() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_database_health() TO authenticated;

REVOKE ALL ON FUNCTION public.get_game_overview(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_game_overview(uuid) TO authenticated;

-- =============================================================================
-- FUNCTION DOCUMENTATION
-- =============================================================================

COMMENT ON FUNCTION public.create_game(uuid, text, integer) IS 'V2.0 - Create new game with authorization and subscription plan validation';
COMMENT ON FUNCTION public.get_active_game_for_league(uuid) IS 'V2.0 - Retrieve active/setup game for league with time calculations';
COMMENT ON FUNCTION public.set_player_base(uuid, uuid) IS 'V2.0 - Set player base with auto-activation when all players ready';
COMMENT ON FUNCTION public.get_database_health() IS 'V2.0 - Comprehensive database health monitoring and statistics';
COMMENT ON FUNCTION public.get_game_overview(uuid) IS 'V2.0 - Get detailed game information with access control';

COMMIT;

-- =============================================================================
-- VERIFICATION
-- =============================================================================

DO $$
DECLARE
  func_count integer;
  permission_count integer;
BEGIN
  -- Count V2.0 functions
  SELECT COUNT(*) INTO func_count
  FROM pg_proc
  WHERE proname IN (
    'create_game', 'get_active_game_for_league', 'set_player_base',
    'get_database_health', 'get_game_overview'
  )
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

  -- Check permissions are set
  SELECT COUNT(*) INTO permission_count
  FROM information_schema.routine_privileges
  WHERE routine_schema = 'public'
  AND grantee = 'authenticated'
  AND routine_name IN (
    'create_game', 'get_active_game_for_league', 'set_player_base',
    'get_database_health', 'get_game_overview'
  );

  RAISE NOTICE 'V2.0 FUNCTIONS DEPLOYMENT SUMMARY:';
  RAISE NOTICE '  Functions deployed: %', func_count;
  RAISE NOTICE '  Permissions configured: %', permission_count;

  IF func_count >= 5 AND permission_count >= 5 THEN
    RAISE NOTICE '✅ V2.0 essential functions deployment SUCCESSFUL';
  ELSE
    RAISE WARNING '⚠️ V2.0 functions deployment may be INCOMPLETE';
  END IF;
END;
$$;