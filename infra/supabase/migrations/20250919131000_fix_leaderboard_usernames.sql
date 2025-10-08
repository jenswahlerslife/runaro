-- Fix leaderboard to properly show usernames and calculate territory area

BEGIN;

-- Update get_game_overview to properly handle leaderboard data with usernames
CREATE OR REPLACE FUNCTION public.get_game_overview(
  p_game_id uuid,
  p_user_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid;
  v_user_profile_id uuid;
  game_info record;
  member_count integer := 0;
  base_count integer := 0;
  leaderboard_data json;
BEGIN
  -- Determine effective user ID
  v_uid := COALESCE(p_user_id, auth.uid());

  IF v_uid IS NULL THEN
    RETURN json_build_object('error', 'Not authenticated');
  END IF;

  -- Get user profile ID
  SELECT id INTO v_user_profile_id
  FROM public.profiles
  WHERE user_id = v_uid;

  IF v_user_profile_id IS NULL THEN
    RETURN json_build_object('error', 'User profile not found');
  END IF;

  -- Get game information
  SELECT g.*
  INTO game_info
  FROM public.games g
  WHERE g.id = p_game_id;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Game not found');
  END IF;

  -- Verify user has access to this game
  IF NOT EXISTS (
    SELECT 1 FROM public.league_members lm
    WHERE lm.league_id = game_info.league_id
      AND lm.user_id = v_uid
      AND lm.status = 'approved'
  ) THEN
    RETURN json_build_object('error', 'Access denied to game');
  END IF;

  -- Get member count for this league
  SELECT COUNT(*) INTO member_count
  FROM public.league_members
  WHERE league_id = game_info.league_id AND status = 'approved';

  -- Get base count for this game
  SELECT COUNT(*) INTO base_count
  FROM public.player_bases
  WHERE game_id = p_game_id;

  -- IMPROVED: Get leaderboard data with proper username display and territory calculation
  SELECT json_agg(
    json_build_object(
      'user_id', pb.user_id,
      'username', COALESCE(p.username, p.display_name, 'Unknown Player'),
      'area_km2', COALESCE(territory_stats.total_area_km2, 0.0)
    ) ORDER BY COALESCE(territory_stats.total_area_km2, 0.0) DESC
  ) INTO leaderboard_data
  FROM public.player_bases pb
  LEFT JOIN public.profiles p ON pb.user_id = p.user_id
  LEFT JOIN (
    -- Calculate actual territory area for each player
    SELECT
      player_id,
      COALESCE(SUM(
        CASE
          WHEN ST_Area(ST_Transform(territory_polygon, 3857)) > 0
          THEN ST_Area(ST_Transform(territory_polygon, 3857)) / 1000000.0  -- Convert to km²
          ELSE 0.0
        END
      ), 0.0) as total_area_km2
    FROM public.territory_ownership
    WHERE game_id = p_game_id
      AND (captured_until IS NULL OR captured_until > NOW())  -- Only active territories
    GROUP BY player_id
  ) territory_stats ON pb.user_id = territory_stats.player_id
  WHERE pb.game_id = p_game_id;

  RETURN json_build_object(
    'meta', json_build_object(
      'id', game_info.id,
      'name', game_info.name,
      'status', game_info.status,
      'duration_days', game_info.duration_days,
      'start_date', game_info.start_date,
      'end_date', game_info.end_date,
      'activated_at', game_info.activated_at,
      'winner_user_id', game_info.winner_user_id
    ),
    'counts', json_build_object(
      'member_count', member_count,
      'base_count', base_count
    ),
    'leaderboard', COALESCE(leaderboard_data, '[]'::json)
  );
END;
$$;

-- Grant permissions
REVOKE ALL ON FUNCTION public.get_game_overview FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_game_overview TO authenticated;

COMMIT;