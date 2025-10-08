-- Fix Gameflow Functions Migration
-- 2025-09-18: Drop conflicting functions and recreate them properly

-- 1. DROP ALL CONFLICTING FUNCTIONS
DROP FUNCTION IF EXISTS public.get_player_game_stats(uuid, uuid);
DROP FUNCTION IF EXISTS public.maybe_activate_game(uuid);
DROP FUNCTION IF EXISTS public.start_game(uuid, integer);
DROP FUNCTION IF EXISTS public.finish_game(uuid);
DROP FUNCTION IF EXISTS public.set_player_base(uuid, uuid);

-- 2. CREATE get_player_game_stats FUNCTION
CREATE OR REPLACE FUNCTION public.get_player_game_stats(
  p_game_id uuid,
  p_user_id uuid
)
RETURNS TABLE (
  total_distance_km numeric,
  total_moving_time_s bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  g record;
  base_date timestamptz;
  window_start timestamptz;
  window_end timestamptz;
BEGIN
  -- Get game details
  SELECT * INTO g
  FROM public.games
  WHERE id = p_game_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 0::numeric, 0::bigint;
    RETURN;
  END IF;

  -- Get player's base date for this game
  SELECT COALESCE(pb.base_date, g.start_date) INTO base_date
  FROM public.player_bases pb
  WHERE pb.game_id = p_game_id AND pb.user_id = p_user_id;

  -- Calculate window
  window_start := GREATEST(COALESCE(base_date, g.start_date), g.start_date);
  window_end := COALESCE(g.end_date, g.start_date + (g.duration_days || ' days')::interval);

  -- Only count stats if game is active and we have valid dates
  IF g.status = 'active' AND window_start IS NOT NULL THEN
    RETURN QUERY
    SELECT
      COALESCE(SUM(ua.distance), 0)::numeric as total_distance_km,
      COALESCE(SUM(ua.moving_time), 0)::bigint as total_moving_time_s
    FROM public.user_activities ua
    WHERE ua.user_id = p_user_id
      AND ua.start_date >= window_start
      AND (window_end IS NULL OR ua.start_date < window_end);
  ELSE
    RETURN QUERY SELECT 0::numeric, 0::bigint;
  END IF;
END;
$$;

-- 3. CREATE maybe_activate_game FUNCTION
CREATE OR REPLACE FUNCTION public.maybe_activate_game(p_game_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  g record;
  member_count integer;
  players_with_bases integer;
  activated boolean := false;
BEGIN
  -- Get game details
  SELECT * INTO g
  FROM public.games
  WHERE id = p_game_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Game not found');
  END IF;

  -- Only activate games in setup status
  IF g.status != 'setup' THEN
    RETURN json_build_object('success', true, 'activated', false, 'reason', 'Game not in setup status');
  END IF;

  -- Count approved league members
  SELECT COUNT(*) INTO member_count
  FROM public.league_members lm
  WHERE lm.league_id = g.league_id AND lm.status = 'approved';

  -- Count players who have set bases for this game
  SELECT COUNT(DISTINCT user_id) INTO players_with_bases
  FROM public.player_bases
  WHERE game_id = p_game_id;

  -- Activate if all members have bases and we have at least 2 members
  IF players_with_bases >= member_count AND member_count >= 2 THEN
    UPDATE public.games
    SET
      status = 'active',
      start_date = NOW(),
      end_date = NOW() + (duration_days || ' days')::interval,
      activated_at = NOW()
    WHERE id = p_game_id;

    activated := true;
  END IF;

  RETURN json_build_object(
    'success', true,
    'activated', activated,
    'member_count', member_count,
    'players_with_bases', players_with_bases,
    'game_status', CASE WHEN activated THEN 'active' ELSE g.status END
  );
END;
$$;

-- 4. CREATE start_game FUNCTION
CREATE OR REPLACE FUNCTION public.start_game(
  p_game_id uuid,
  p_duration_days integer DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid;
  g record;
  user_plan text := 'free';
  final_duration_days integer;
  activation_result json;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Get game details
  SELECT * INTO g
  FROM public.games
  WHERE id = p_game_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Game not found');
  END IF;

  -- Check if user is authorized (league member)
  IF NOT EXISTS (
    SELECT 1 FROM public.league_members lm
    WHERE lm.league_id = g.league_id
      AND lm.user_id = v_uid
      AND lm.status = 'approved'
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Not authorized for this league');
  END IF;

  -- Get user's subscription plan (fallback to 'free' if function doesn't exist)
  BEGIN
    SELECT get_user_plan(v_uid) INTO user_plan;
  EXCEPTION WHEN undefined_function THEN
    user_plan := 'free';
  END;

  -- Set duration_days if provided
  IF p_duration_days IS NOT NULL THEN
    -- Validate duration based on plan
    IF user_plan = 'free' OR user_plan IS NULL THEN
      -- Free plan: must be exactly 14 days
      IF p_duration_days != 14 THEN
        RETURN json_build_object(
          'success', false,
          'error', 'Free plan only allows 14-day games'
        );
      END IF;
      final_duration_days := 14;
    ELSIF user_plan = 'pro' THEN
      -- Pro plan: validate range 14-30 days
      IF p_duration_days < 14 OR p_duration_days > 30 THEN
        RETURN json_build_object(
          'success', false,
          'error', 'Pro plan allows 14-30 day games'
        );
      END IF;
      final_duration_days := p_duration_days;
    ELSE
      -- Fallback: treat as free plan
      final_duration_days := 14;
    END IF;

    -- Update game duration
    UPDATE public.games
    SET duration_days = final_duration_days
    WHERE id = p_game_id;
  END IF;

  -- Try to activate the game
  SELECT public.maybe_activate_game(p_game_id) INTO activation_result;

  RETURN json_build_object(
    'success', true,
    'game_id', p_game_id,
    'duration_days', COALESCE(final_duration_days, g.duration_days),
    'user_plan', user_plan,
    'activation_result', activation_result
  );
END;
$$;

-- 5. CREATE finish_game FUNCTION
CREATE OR REPLACE FUNCTION public.finish_game(p_game_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  g record;
  winner_user_id uuid;
  max_area numeric := 0;
  player_record record;
BEGIN
  -- Get game details
  SELECT * INTO g
  FROM public.games
  WHERE id = p_game_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Game not found');
  END IF;

  -- Only finish active games
  IF g.status != 'active' THEN
    RETURN json_build_object('success', false, 'error', 'Game is not active');
  END IF;

  -- Find winner (player with largest territory area)
  FOR player_record IN
    SELECT
      lm.user_id,
      COALESCE(SUM(to_.area_km2), 0) as total_area
    FROM public.league_members lm
    LEFT JOIN public.territory_ownership to_
      ON to_.user_id = lm.user_id
      AND to_.league_id = g.league_id
      AND to_.claimed_at >= g.start_date
      AND (g.end_date IS NULL OR to_.claimed_at < g.end_date)
    WHERE lm.league_id = g.league_id
      AND lm.status = 'approved'
    GROUP BY lm.user_id
    ORDER BY total_area DESC
    LIMIT 1
  LOOP
    winner_user_id := player_record.user_id;
    max_area := player_record.total_area;
    EXIT; -- Take the first (highest) result
  END LOOP;

  -- Update game status to finished
  UPDATE public.games
  SET
    status = 'finished',
    winner_user_id = winner_user_id,
    finished_at = NOW()
  WHERE id = p_game_id;

  RETURN json_build_object(
    'success', true,
    'game_id', p_game_id,
    'winner_user_id', winner_user_id,
    'winner_area_km2', max_area,
    'finished_at', NOW()
  );
END;
$$;

-- 6. CREATE set_player_base FUNCTION (updated with auto-activation)
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
  activation_result json;
BEGIN
  v_uid := auth.uid();
  if v_uid is null then
    return json_build_object('success', false, 'error', 'Not authenticated');
  end if;

  -- Get activity data with territory
  select ua.id, ua.user_id, a.territory_geom, a.name, a.start_point, ua.start_date
  into activity_data
  from public.user_activities ua
  join public.activities a on ua.activity_id = a.id
  where ua.id = p_activity_id and ua.user_id = v_uid;

  if not found then
    return json_build_object('success', false, 'error', 'Activity not found or not owned by user');
  end if;

  -- Verify game exists and user is member
  if not exists (
    select 1 from public.games g
    join public.league_members lm on g.league_id = lm.league_id
    where g.id = p_game_id and lm.user_id = v_uid and lm.status = 'approved'
  ) then
    return json_build_object('success', false, 'error', 'Game not found or user not authorized');
  end if;

  -- Insert or update player base
  insert into public.player_bases (
    game_id, user_id, activity_id, base_territory, base_point, base_date
  )
  values (
    p_game_id, v_uid, p_activity_id,
    activity_data.territory_geom, activity_data.start_point, activity_data.start_date
  )
  on conflict (game_id, user_id)
  do update set
    activity_id = excluded.activity_id,
    base_territory = excluded.base_territory,
    base_point = excluded.base_point,
    base_date = excluded.base_date,
    updated_at = now()
  returning * into base_record;

  -- Try to activate the game
  SELECT public.maybe_activate_game(p_game_id) INTO activation_result;

  return json_build_object(
    'success', true,
    'base_id', base_record.id,
    'activity_name', activity_data.name,
    'base_date', activity_data.start_date,
    'activation_result', activation_result
  );
END;
$$;

-- 7. ADD MISSING COLUMNS TO GAMES TABLE (if they don't exist)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'games' AND column_name = 'activated_at') THEN
    ALTER TABLE public.games ADD COLUMN activated_at timestamptz;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'games' AND column_name = 'finished_at') THEN
    ALTER TABLE public.games ADD COLUMN finished_at timestamptz;
  END IF;
END;
$$;

-- 8. ADD MISSING COLUMNS TO PLAYER_BASES TABLE (if they don't exist)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'player_bases' AND column_name = 'base_date') THEN
    ALTER TABLE public.player_bases ADD COLUMN base_date timestamptz;
  END IF;
END;
$$;

-- 9. SET PERMISSIONS FOR ALL FUNCTIONS
REVOKE ALL ON FUNCTION public.get_player_game_stats(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_player_game_stats(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.maybe_activate_game(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.maybe_activate_game(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.start_game(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_game(uuid, integer) TO authenticated;

REVOKE ALL ON FUNCTION public.finish_game(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finish_game(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.set_player_base(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_player_base(uuid, uuid) TO authenticated;

-- 10. ADD FUNCTION COMMENTS
COMMENT ON FUNCTION public.get_player_game_stats(uuid, uuid) IS 'Get player statistics for a specific game within the game window';
COMMENT ON FUNCTION public.maybe_activate_game(uuid) IS 'Auto-activate game if all players have set their bases';
COMMENT ON FUNCTION public.start_game(uuid, integer) IS 'Start a game with duration validation and auto-activation check';
COMMENT ON FUNCTION public.finish_game(uuid) IS 'Finish an active game and determine winner by territory area';
COMMENT ON FUNCTION public.set_player_base(uuid, uuid) IS 'Set player base activity and try to activate game';

-- 11. VERIFICATION
DO $$
DECLARE
  func_count integer;
BEGIN
  -- Count all game-related functions
  SELECT COUNT(*) INTO func_count
  FROM pg_proc
  WHERE proname IN (
    'get_player_game_stats', 'maybe_activate_game', 'start_game',
    'finish_game', 'set_player_base'
  )
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

  IF func_count >= 5 THEN
    RAISE NOTICE 'SUCCESS: All % gameflow functions created and deployed', func_count;
  ELSE
    RAISE WARNING 'INCOMPLETE: Only % of 5 expected gameflow functions found', func_count;
  END IF;
END;
$$;