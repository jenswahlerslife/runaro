-- Add simple function to get game info for setup page
CREATE OR REPLACE FUNCTION public.get_game_info(p_game_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result jsonb;
  v_user_profile_id uuid;
BEGIN
  -- Get user profile ID
  SELECT id INTO v_user_profile_id FROM public.profiles WHERE user_id = auth.uid();

  IF v_user_profile_id IS NULL THEN
    RETURN jsonb_build_object('error', 'User profile not found');
  END IF;

  -- Check if user is a member of the league that owns this game
  WITH game_access AS (
    SELECT g.id, g.name, g.status, g.created_at, g.start_at, g.league_id
    FROM public.games g
    JOIN public.league_members lm ON lm.league_id = g.league_id
    WHERE g.id = p_game_id
      AND lm.user_id = v_user_profile_id
      AND lm.status = 'active'
  )
  SELECT jsonb_build_object(
    'id', ga.id,
    'name', ga.name,
    'status', ga.status,
    'created_at', ga.created_at,
    'start_at', ga.start_at,
    'league_id', ga.league_id
  ) INTO v_result
  FROM game_access ga;

  -- Return empty object if no access or game not found
  RETURN COALESCE(v_result, jsonb_build_object('error', 'Game not found or no access'));
END;
$$;

-- Set proper ownership and privileges
ALTER FUNCTION public.get_game_info(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_game_info(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_game_info(uuid) TO authenticated;