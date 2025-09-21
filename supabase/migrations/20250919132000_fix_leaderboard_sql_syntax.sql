-- Fix SQL syntax error in leaderboard query

BEGIN;

-- Update get_game_overview to fix ORDER BY syntax
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

  -- FIXED: Simplified leaderboard query with proper subquery structure
  WITH leaderboard_query AS (
    SELECT
      pb.user_id,
      COALESCE(p.username, p.display_name, 'Unknown Player') as username,
      0.0 as area_km2,  -- Placeholder until territory system is implemented
      pb.created_at
    FROM public.player_bases pb
    LEFT JOIN public.profiles p ON pb.user_id = p.user_id
    WHERE pb.game_id = p_game_id
    ORDER BY pb.created_at ASC
  )
  SELECT json_agg(
    json_build_object(
      'user_id', user_id,
      'username', username,
      'area_km2', area_km2
    )
  ) INTO leaderboard_data
  FROM leaderboard_query;

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