-- Function Consolidation Migration
-- 2025-09-16: Consolidate and fix all core database functions

SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '10s';
SET LOCAL idle_in_transaction_session_timeout = '20s';

-- 1. CLEAN UP CONFLICTING FUNCTIONS
-- Remove all versions to start fresh
DROP FUNCTION IF EXISTS public.create_game(uuid, text, integer);
DROP FUNCTION IF EXISTS public.create_game(uuid, text);
DROP FUNCTION IF EXISTS public.get_active_game_for_league(uuid);
DROP FUNCTION IF EXISTS public.set_player_base(uuid, uuid);
DROP FUNCTION IF EXISTS public.get_database_health();

-- 2. CREATE CONSOLIDATED CREATE_GAME FUNCTION (single version)
-- Handles both 2-param and 3-param calls through default parameter
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

-- 3. CREATE CONSOLIDATED GET_ACTIVE_GAME_FOR_LEAGUE FUNCTION
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

-- 4. CREATE CONSOLIDATED SET_PLAYER_BASE FUNCTION
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

-- 5. CREATE DATABASE HEALTH FUNCTION
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
    'player_bases', (SELECT COUNT(*) FROM public.player_bases),
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
    'table_counts', table_counts,
    'function_status', function_status,
    'setup_games', (SELECT COUNT(*) FROM public.games WHERE status = 'setup'),
    'active_games', (SELECT COUNT(*) FROM public.games WHERE status = 'active'),
    'strava_connected_users', (SELECT COUNT(*) FROM public.profiles WHERE strava_access_token IS NOT NULL)
  ) INTO health_data;

  RETURN health_data;
END;
$$;

-- 6. SET PERMISSIONS FOR ALL FUNCTIONS
REVOKE ALL ON FUNCTION public.create_game(uuid, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_game(uuid, text, integer) TO authenticated;

REVOKE ALL ON FUNCTION public.get_active_game_for_league(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_active_game_for_league(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.set_player_base(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_player_base(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.get_database_health() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_database_health() TO authenticated;

-- 7. ADD FUNCTION COMMENTS
COMMENT ON FUNCTION public.create_game(uuid, text, integer) IS 'Consolidated create_game function - handles both 2-param and 3-param calls with default duration';
COMMENT ON FUNCTION public.get_active_game_for_league(uuid) IS 'Consolidated get_active_game_for_league - returns proper game object structure';
COMMENT ON FUNCTION public.set_player_base(uuid, uuid) IS 'Consolidated set_player_base - includes auto-activation logic';
COMMENT ON FUNCTION public.get_database_health() IS 'Database health monitoring function for operational visibility';

-- 8. VERIFICATION
DO $$
DECLARE
  func_count integer;
BEGIN
  -- Count consolidated functions
  SELECT COUNT(*) INTO func_count
  FROM pg_proc
  WHERE proname IN ('create_game', 'get_active_game_for_league', 'set_player_base', 'get_database_health')
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

  IF func_count >= 4 THEN
    RAISE NOTICE 'SUCCESS: All % core functions consolidated and deployed', func_count;
  ELSE
    RAISE WARNING 'INCOMPLETE: Only % of 4 expected functions found', func_count;
  END IF;
END;
$$;