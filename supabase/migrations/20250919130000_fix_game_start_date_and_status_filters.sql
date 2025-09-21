-- Fix critical game flow issues:
-- 1. create_game should NOT set start_date until activation
-- 2. get_game_overview should use status='approved' not deprecated approved column

BEGIN;

-- 1. Fix create_game to keep start_date NULL until activation
CREATE OR REPLACE FUNCTION public.create_game(
  p_league_id uuid,
  p_name text,
  p_duration_days integer DEFAULT 14,
  p_user_id uuid DEFAULT NULL
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
  effective_user_id uuid;
BEGIN
  -- Determine effective user ID
  effective_user_id := COALESCE(p_user_id, auth.uid());

  IF effective_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'No user context provided');
  END IF;

  -- Get user profile ID
  SELECT id INTO user_profile_id
  FROM public.profiles
  WHERE user_id = effective_user_id;

  IF user_profile_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User profile not found for user: ' || effective_user_id);
  END IF;

  -- Check authorization
  IF EXISTS (SELECT 1 FROM public.leagues WHERE id = p_league_id AND admin_user_id = user_profile_id)
     OR EXISTS (
       SELECT 1 FROM public.league_members
       WHERE league_id = p_league_id AND user_id = effective_user_id AND role IN ('admin', 'owner') AND status='approved'
     )
  THEN
     is_authorized := true;
  END IF;

  IF NOT is_authorized THEN
    RETURN json_build_object('success', false, 'error', 'Not authorized to create games in this league');
  END IF;

  -- Check approved member count
  SELECT COUNT(*) INTO member_count
  FROM public.league_members
  WHERE league_id = p_league_id AND status='approved';

  IF member_count < 2 THEN
    RETURN json_build_object('success', false, 'error', 'League needs at least 2 approved members to create a game');
  END IF;

  -- Get user's subscription plan
  BEGIN
    SELECT get_user_plan(effective_user_id) INTO user_plan;
  EXCEPTION WHEN undefined_function THEN
    user_plan := 'free';
  END;

  -- Validate duration based on plan
  IF user_plan = 'free' OR user_plan IS NULL THEN
    final_duration_days := 14;
  ELSIF user_plan = 'pro' THEN
    IF p_duration_days < 14 OR p_duration_days > 30 THEN
      RETURN json_build_object('success', false, 'error', 'For Pro plans, duration_days must be between 14 and 30 days');
    ELSE
      final_duration_days := p_duration_days;
    END IF;
  ELSE
    final_duration_days := 14;
  END IF;

  -- CRITICAL FIX: Create game with start_date=NULL until activation
  -- The game clock should not start until maybe_activate_game promotes it
  INSERT INTO public.games (league_id, name, status, created_by, duration_days, start_date)
  VALUES (p_league_id, p_name, 'setup', user_profile_id, final_duration_days, NULL)
  RETURNING * INTO game_record;

  RETURN json_build_object(
    'success', true,
    'id', game_record.id,
    'game_id', game_record.id,
    'game_name', game_record.name,
    'duration_days', game_record.duration_days,
    'start_date', game_record.start_date,  -- Will be NULL
    'status', game_record.status,
    'user_plan', COALESCE(user_plan, 'free'),
    'member_count', member_count
  );
END;
$$;

-- 2. Fix get_game_overview to use status='approved' instead of deprecated approved column
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
      AND lm.status = 'approved'  -- FIXED: Use status='approved' not deprecated approved column
  ) THEN
    RETURN json_build_object('error', 'Access denied to game');
  END IF;

  -- Get member count for this league (FIXED: Use status='approved')
  SELECT COUNT(*) INTO member_count
  FROM public.league_members
  WHERE league_id = game_info.league_id AND status = 'approved';

  -- Get base count for this game
  SELECT COUNT(*) INTO base_count
  FROM public.player_bases
  WHERE game_id = p_game_id;

  -- Get leaderboard data with proper joins to get user names
  SELECT json_agg(
    json_build_object(
      'user_id', pb.user_id,
      'username', COALESCE(p.username, p.display_name, 'Unknown'),
      'area_km2', 0  -- TODO: Calculate actual territory area
    )
  ) INTO leaderboard_data
  FROM public.player_bases pb
  LEFT JOIN public.profiles p ON pb.user_id = p.user_id
  WHERE pb.game_id = p_game_id;

  RETURN json_build_object(
    'meta', json_build_object(
      'id', game_info.id,
      'name', game_info.name,
      'status', game_info.status,
      'duration_days', game_info.duration_days,
      'start_date', game_info.start_date,  -- Will be NULL until activation
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

-- 3. Update maybe_activate_game to properly set start_date when activating
-- This function should be called when the last player sets their base
CREATE OR REPLACE FUNCTION public.maybe_activate_game(p_game_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  game_record record;
  league_member_count integer;
  player_base_count integer;
  can_activate boolean := false;
BEGIN
  -- Get game information
  SELECT * INTO game_record FROM public.games WHERE id = p_game_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Game not found');
  END IF;

  -- Only activate games in 'setup' status
  IF game_record.status != 'setup' THEN
    RETURN json_build_object('success', false, 'error', 'Game is not in setup status');
  END IF;

  -- Count approved league members
  SELECT COUNT(*) INTO league_member_count
  FROM public.league_members
  WHERE league_id = game_record.league_id AND status = 'approved';

  -- Count players with bases set
  SELECT COUNT(*) INTO player_base_count
  FROM public.player_bases
  WHERE game_id = p_game_id;

  -- Check if all members have set their bases
  IF player_base_count >= league_member_count AND league_member_count >= 2 THEN
    can_activate := true;
  END IF;

  IF can_activate THEN
    -- CRITICAL: Set start_date to NOW() when activating, calculate end_date
    UPDATE public.games
    SET
      status = 'active',
      start_date = NOW(),
      end_date = NOW() + (duration_days || ' days')::interval,
      activated_at = NOW()
    WHERE id = p_game_id;

    RETURN json_build_object(
      'success', true,
      'activated', true,
      'message', 'Game activated successfully',
      'member_count', league_member_count,
      'players_with_bases', player_base_count
    );
  ELSE
    RETURN json_build_object(
      'success', true,
      'activated', false,
      'message', 'Waiting for more players to set bases',
      'member_count', league_member_count,
      'players_with_bases', player_base_count
    );
  END IF;
END;
$$;

-- Grant permissions
REVOKE ALL ON FUNCTION public.create_game FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_game TO authenticated;

REVOKE ALL ON FUNCTION public.get_game_overview FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_game_overview TO authenticated;

REVOKE ALL ON FUNCTION public.maybe_activate_game FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.maybe_activate_game TO authenticated;

COMMIT;