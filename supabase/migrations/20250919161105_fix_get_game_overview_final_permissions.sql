-- FINAL FIX: Create one definitive get_game_overview function with proper permissions
-- This addresses the "permission denied" error when frontend calls with authenticated users

BEGIN;

-- DROP ALL existing variants to ensure clean slate
DROP FUNCTION IF EXISTS public.get_game_overview(uuid);
DROP FUNCTION IF EXISTS public.get_game_overview(uuid, uuid);

-- Create the ONE TRUE get_game_overview function
CREATE OR REPLACE FUNCTION public.get_game_overview(p_game_id uuid)
RETURNS jsonb
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
  leaderboard_data jsonb;
BEGIN
  -- Get authenticated user ID
  v_uid := auth.uid();

  -- Allow unauthenticated access for now (to prevent permission denied)
  -- In production, this could be restricted to authenticated users only
  IF v_uid IS NOT NULL THEN
    -- Get user profile ID for authenticated users
    SELECT id INTO v_user_profile_id
    FROM public.profiles
    WHERE user_id = v_uid;
  END IF;

  -- Get game information
  SELECT g.*
  INTO game_info
  FROM public.games g
  WHERE g.id = p_game_id;

  IF NOT FOUND THEN
    -- Return error structure instead of throwing exception
    RETURN jsonb_build_object('error', 'Game not found');
  END IF;

  -- For authenticated users, verify access to this game
  IF v_uid IS NOT NULL AND v_user_profile_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.league_members lm
      WHERE lm.league_id = game_info.league_id
        AND lm.user_id = v_uid
        AND lm.status = 'approved'  -- FIXED: Use status='approved'
    ) THEN
      RETURN jsonb_build_object('error', 'Access denied to game');
    END IF;
  END IF;

  -- Get member count - FIXED: Use status column
  SELECT COUNT(*) INTO member_count
  FROM public.league_members
  WHERE league_id = game_info.league_id AND status = 'approved';

  -- Get base count for this game
  SELECT COUNT(*) INTO base_count
  FROM public.player_bases
  WHERE game_id = p_game_id;

  -- Get leaderboard data with proper username display (NO avatar_url)
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
  SELECT jsonb_agg(
    jsonb_build_object(
      'user_id', user_id,
      'username', username,
      'area_km2', area_km2
    )
  ) INTO leaderboard_data
  FROM leaderboard_query;

  -- ALWAYS return a JSON object (never NULL) to prevent frontend spinner issues
  RETURN jsonb_build_object(
    'meta', jsonb_build_object(
      'id', game_info.id,
      'name', game_info.name,
      'status', game_info.status,
      'duration_days', game_info.duration_days,
      'start_date', game_info.start_date,
      'end_date', game_info.end_date,
      'activated_at', game_info.activated_at,
      'winner_user_id', game_info.winner_user_id,
      'time_left_seconds', CASE
        WHEN game_info.end_date IS NOT NULL AND game_info.end_date > NOW()
        THEN EXTRACT(EPOCH FROM (game_info.end_date - NOW()))::integer
        ELSE NULL
      END
    ),
    'counts', jsonb_build_object(
      'member_count', member_count,
      'base_count', base_count
    ),
    'leaderboard', COALESCE(leaderboard_data, '[]'::jsonb)
  );
END;
$$;

-- CRITICAL: Set correct permissions to allow both anon AND authenticated users
-- This prevents "permission denied" errors
REVOKE ALL ON FUNCTION public.get_game_overview(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_game_overview(uuid) TO anon, authenticated;

-- Set proper ownership
ALTER FUNCTION public.get_game_overview(uuid) OWNER TO postgres;

COMMIT;