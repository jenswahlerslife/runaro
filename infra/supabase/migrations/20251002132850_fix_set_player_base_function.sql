-- Fix set_player_base function to work with current schema
-- Problem: Old function expected user_activities.activity_id -> activities.id
-- Solution: Use user_activities.id directly and map auth.uid() -> profiles.id

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
  v_profile_id uuid;
  ua_row record;
  base_record record;
  member_count integer;
  players_with_bases integer;
  v_base_territory geometry(Polygon, 4326);
  v_base_point geometry(Point, 4326);
BEGIN
  -- Get authenticated user
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Map auth.uid() to profiles.id
  SELECT id INTO v_profile_id
  FROM public.profiles
  WHERE user_id = v_uid;

  IF v_profile_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User profile not found');
  END IF;

  -- Fetch user-owned activity from user_activities (not activities table)
  SELECT ua.id, ua.user_id, ua.route, ua.polyline, ua.name, ua.start_date
  INTO ua_row
  FROM public.user_activities ua
  WHERE ua.id = p_activity_id
    AND ua.user_id = v_profile_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Activity not found or not owned by user');
  END IF;

  -- Verify user is approved member of the game's league
  IF NOT EXISTS (
    SELECT 1
    FROM public.games g
    JOIN public.league_members lm ON g.league_id = lm.league_id
    WHERE g.id = p_game_id
      AND lm.user_id = v_profile_id
      AND lm.status = 'approved'
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Game not found or user not authorized');
  END IF;

  -- Derive base geometry from route if available (buffer 50m for territory)
  IF ua_row.route IS NOT NULL THEN
    v_base_territory := ST_Buffer(ua_row.route::geography, 50)::geometry;
    v_base_point := ST_StartPoint(ua_row.route);
  ELSE
    -- No route geometry yet; will be computed later or left NULL
    v_base_territory := NULL;
    v_base_point := NULL;
  END IF;

  -- Insert or update player base
  INSERT INTO public.player_bases (game_id, user_id, activity_id, base_territory, base_point)
  VALUES (p_game_id, v_profile_id, p_activity_id, v_base_territory, v_base_point)
  ON CONFLICT (game_id, user_id)
  DO UPDATE SET
    activity_id = EXCLUDED.activity_id,
    base_territory = EXCLUDED.base_territory,
    base_point = EXCLUDED.base_point,
    updated_at = NOW()
  RETURNING * INTO base_record;

  -- Count approved league members for this game
  SELECT COUNT(*) INTO member_count
  FROM public.league_members lm
  JOIN public.games g ON g.league_id = lm.league_id
  WHERE g.id = p_game_id AND lm.status = 'approved';

  -- Count how many players have set their bases
  SELECT COUNT(DISTINCT user_id) INTO players_with_bases
  FROM public.player_bases
  WHERE game_id = p_game_id;

  -- Auto-activate game if all approved members have bases (minimum 2 players)
  IF players_with_bases >= member_count AND member_count >= 2 THEN
    UPDATE public.games
    SET status = 'active', activated_at = NOW()
    WHERE id = p_game_id AND status = 'setup';
  END IF;

  -- Return success with activation details
  RETURN json_build_object(
    'success', true,
    'base_id', base_record.id,
    'activation_result', json_build_object(
      'players_with_bases', players_with_bases,
      'member_count', member_count,
      'activated', (players_with_bases >= member_count AND member_count >= 2)
    )
  );
END;
$$;

-- Ensure proper security grants
REVOKE ALL ON FUNCTION public.set_player_base(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_player_base(uuid, uuid) TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION public.set_player_base(uuid, uuid) IS 'Set player base for a game using user_activities.id. Maps auth.uid() to profiles.id for ownership checks. Auto-activates game when all members have bases.';
