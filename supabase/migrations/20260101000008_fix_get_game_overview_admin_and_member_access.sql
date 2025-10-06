-- POST-V2 FIX: Allow league admin OR approved member to access game overview
-- Also enforces canonical auth mapping (auth.uid() -> profiles.id)

DROP FUNCTION IF EXISTS public.get_game_overview(uuid);

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
  is_authorized boolean := false;
BEGIN
  -- Current user
  v_uid := auth.uid();

  -- Map auth.uid() to profiles.id when authenticated
  IF v_uid IS NOT NULL THEN
    SELECT id INTO v_profile_id FROM public.profiles WHERE user_id = v_uid;
  END IF;

  -- Load game
  SELECT g.* INTO game_info FROM public.games g WHERE g.id = p_game_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Game not found');
  END IF;

  -- Authorization: allow if user is league admin OR approved member
  IF v_profile_id IS NOT NULL THEN
    SELECT TRUE INTO is_authorized
    FROM public.leagues l
    WHERE l.id = game_info.league_id AND l.admin_user_id = v_profile_id;

    IF NOT is_authorized THEN
      SELECT TRUE INTO is_authorized
      FROM public.league_members lm
      WHERE lm.league_id = game_info.league_id
        AND lm.user_id = v_profile_id
        AND lm.status = 'approved';
    END IF;

    IF NOT is_authorized THEN
      RETURN jsonb_build_object('error', 'Access denied to game');
    END IF;
  END IF;

  -- Member/base counts
  SELECT COUNT(*) INTO member_count
  FROM public.league_members
  WHERE league_id = game_info.league_id AND status = 'approved';

  SELECT COUNT(*) INTO base_count
  FROM public.player_bases
  WHERE game_id = p_game_id;

  -- Leaderboard: join profiles by profile id (pb.user_id = p.id)
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

REVOKE ALL ON FUNCTION public.get_game_overview(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_game_overview(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_game_overview(uuid) IS 'POST-V2 FIX: Grants access to league admin OR approved member; maps auth.uid() to profiles.id; fixes leaderboard join.';

