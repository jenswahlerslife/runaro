-- 2025-09-13: Game duration + auto-activation + finish + overview

-- ============ GAMES kolonner ============
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='games' AND column_name='duration_days') THEN
    ALTER TABLE public.games ADD COLUMN duration_days integer;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='games' AND column_name='activated_at') THEN
    ALTER TABLE public.games ADD COLUMN activated_at timestamptz;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='games' AND column_name='winner_user_id') THEN
    ALTER TABLE public.games ADD COLUMN winner_user_id uuid REFERENCES public.profiles (id);
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_games_status_end_date ON public.games(status, end_date);
CREATE INDEX IF NOT EXISTS idx_games_league_id ON public.games(league_id);

-- ============ PLAYER_BASES constraint ============
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'player_bases') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'player_bases_unique_game_user') THEN
      ALTER TABLE public.player_bases
        ADD CONSTRAINT player_bases_unique_game_user UNIQUE (game_id, user_id);
    END IF;
  END IF;
END$$;

-- ============ Helper: maybe_activate_game ============
CREATE OR REPLACE FUNCTION public.maybe_activate_game(p_game_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member_count int;
  v_base_count   int;
  v_duration     int;
  v_is_active    boolean;
BEGIN
  SELECT duration_days, (status = 'active') AS is_active
    INTO v_duration, v_is_active
  FROM public.games
  WHERE id = p_game_id
  FOR UPDATE;

  IF v_is_active THEN
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_member_count
  FROM public.league_members
  WHERE league_id = (SELECT league_id FROM public.games WHERE id = p_game_id)
    AND status = 'active';

  SELECT COUNT(*) INTO v_base_count
  FROM public.player_bases
  WHERE game_id = p_game_id;

  IF v_member_count IS NOT NULL AND v_base_count = v_member_count THEN
    UPDATE public.games
       SET status       = 'active',
           activated_at = now(),
           start_date   = now(),
           end_date     = (now() + make_interval(days => COALESCE(v_duration, 14)))
     WHERE id = p_game_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.maybe_activate_game(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.maybe_activate_game(uuid) TO authenticated;

-- ============ Start_game med varighed & plan-gating ============
CREATE OR REPLACE FUNCTION public.start_game(p_game_id uuid, p_duration_days int DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin   boolean;
  v_plan       text;
  v_league_id  uuid;
  v_uid        uuid := auth.uid();
  v_allowed_max int := 14;
  user_profile_id uuid;
  game_record record;
  base_count integer;
BEGIN
  SELECT id INTO user_profile_id FROM public.profiles WHERE user_id = v_uid;
  
  IF user_profile_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User profile not found');
  END IF;

  -- Get game and check if user is league admin
  SELECT g.*, l.admin_user_id INTO game_record
  FROM public.games g
  JOIN public.leagues l ON g.league_id = l.id
  WHERE g.id = p_game_id;

  IF game_record IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Game not found');
  END IF;

  IF game_record.admin_user_id != user_profile_id THEN
    RETURN json_build_object('success', false, 'error', 'Only league admins can start games');
  END IF;

  -- Subscription gating
  SELECT CASE WHEN s.is_active AND s.plan IN ('pro','enterprise') THEN 'pro' ELSE 'free' END
    INTO v_plan
  FROM public.subscribers s
  WHERE s.user_id = v_uid
  ORDER BY s.updated_at DESC NULLS LAST
  LIMIT 1;

  IF v_plan = 'pro' THEN
    v_allowed_max := 30;
  END IF;

  IF p_duration_days IS NULL THEN
    p_duration_days := 14;
  END IF;

  IF p_duration_days > v_allowed_max THEN
    RETURN json_build_object('success', false, 'error', format('Duration exceeds your plan limit (%s days).', v_allowed_max));
  END IF;

  -- Count bases set
  SELECT COUNT(*) INTO base_count 
  FROM public.player_bases 
  WHERE game_id = p_game_id;

  -- gem varigheden (spillet aktiveres når alle har base)
  UPDATE public.games
     SET duration_days = p_duration_days,
         status = 'setup'
   WHERE id = p_game_id;

  -- hvis alle allerede har base, aktiver nu
  PERFORM public.maybe_activate_game(p_game_id);

  RETURN json_build_object(
    'success', true,
    'duration_days', p_duration_days,
    'base_count', base_count,
    'plan', v_plan,
    'allowed_max', v_allowed_max
  );
END;
$$;

-- ============ Finish_game: afslut og kåre vinder ============
CREATE OR REPLACE FUNCTION public.finish_game(p_game_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now    timestamptz := now();
  v_end    timestamptz;
  v_winner uuid;
BEGIN
  SELECT end_date INTO v_end FROM public.games WHERE id = p_game_id FOR UPDATE;
  IF v_end IS NULL OR v_now < v_end THEN
    RETURN;
  END IF;

  WITH area_by_user AS (
    SELECT ut.user_id, SUM(ut.area_km2) AS total_area
    FROM public.user_territories ut
    WHERE ut.game_id = p_game_id
    GROUP BY ut.user_id
  )
  SELECT user_id
    INTO v_winner
  FROM area_by_user
  ORDER BY total_area DESC NULLS LAST
  LIMIT 1;

  UPDATE public.games
     SET status = 'finished',
         winner_user_id = v_winner
   WHERE id = p_game_id;
END;
$$;

REVOKE ALL ON FUNCTION public.finish_game(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finish_game(uuid) TO service_role;

-- ============ Oversigts-RPC til GamePage ============
CREATE OR REPLACE FUNCTION public.get_game_overview(p_game_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v jsonb;
BEGIN
  WITH members AS (
    SELECT lm.user_id
    FROM public.league_members lm
    JOIN public.games g ON g.league_id = lm.league_id
    WHERE g.id = p_game_id AND lm.status = 'active'
  ),
  bases AS (
    SELECT user_id FROM public.player_bases WHERE game_id = p_game_id
  ),
  counts AS (
    SELECT (SELECT COUNT(*) FROM members) AS member_count,
           (SELECT COUNT(*) FROM bases)   AS base_count
  ),
  meta AS (
    SELECT g.id, g.status, g.duration_days, g.start_date, g.end_date, g.activated_at, g.winner_user_id
    FROM public.games g
    WHERE g.id = p_game_id
  ),
  leaderboard AS (
    SELECT ut.user_id, COALESCE(SUM(ut.area_km2),0) AS area_km2
    FROM public.user_territories ut
    WHERE ut.game_id = p_game_id
    GROUP BY ut.user_id
  )
  SELECT jsonb_build_object(
    'meta',        (SELECT to_jsonb(meta.*)   FROM meta),
    'counts',      (SELECT to_jsonb(counts.*) FROM counts),
    'leaderboard', COALESCE((SELECT jsonb_agg(to_jsonb(leaderboard.*)) FROM leaderboard), '[]'::jsonb)
  ) INTO v;

  RETURN v;
END;
$$;

REVOKE ALL ON FUNCTION public.get_game_overview(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_game_overview(uuid) TO authenticated;

-- ============ Stats-RPC pr. spiller ============
-- Note: This function depends on player_bases and user_activities tables existing
-- It will be created when those tables are available
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'player_bases') 
     AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_activities') THEN
    
    EXECUTE '
    CREATE OR REPLACE FUNCTION public.get_player_game_stats(p_game_id uuid, p_user_id uuid)
    RETURNS TABLE(total_distance_km numeric, total_moving_time_s bigint)
    LANGUAGE sql
    SECURITY DEFINER
    SET search_path = public
    AS $func$
      WITH meta AS (
        SELECT start_date, end_date FROM public.games WHERE id = p_game_id
      ),
      base AS (
        SELECT base_date FROM public.player_bases WHERE game_id = p_game_id AND user_id = p_user_id
      )
      SELECT
        COALESCE(SUM(ua.distance_km), 0)::numeric AS total_distance_km,
        COALESCE(SUM(ua.moving_time_s), 0)::bigint AS total_moving_time_s
      FROM public.user_activities ua, meta, base
      WHERE ua.user_id = p_user_id
        AND ua.started_at >= base.base_date
        AND ua.started_at >= meta.start_date
        AND ua.started_at <  COALESCE(meta.end_date, now());
    $func$;';
    
  END IF;
END$$;

-- Grant permissions only if function was created
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'get_player_game_stats') THEN
    REVOKE ALL ON FUNCTION public.get_player_game_stats(uuid, uuid) FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION public.get_player_game_stats(uuid, uuid) TO authenticated;
  END IF;
END$$;

SELECT 'Game duration and activation functions created successfully!' as status;