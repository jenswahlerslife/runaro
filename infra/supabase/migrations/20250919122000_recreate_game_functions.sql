-- Recreate game functions with auth context fixes
-- This migration recreates the functions after cleanup

BEGIN;

-- 1. Create new create_game function with explicit user_id parameter
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
  -- Determine effective user ID: use parameter if provided, otherwise auth.uid()
  effective_user_id := COALESCE(p_user_id, auth.uid());

  IF effective_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'No user context provided');
  END IF;

  -- Get user profile ID from effective user ID
  SELECT id INTO user_profile_id
  FROM public.profiles
  WHERE user_id = effective_user_id;

  IF user_profile_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User profile not found for user: ' || effective_user_id);
  END IF;

  -- Check if user is league owner OR admin
  IF EXISTS (SELECT 1 FROM public.leagues WHERE id = p_league_id AND admin_user_id = user_profile_id)
     OR EXISTS (
       SELECT 1 FROM public.league_members
       WHERE league_id = p_league_id AND user_id = user_profile_id AND role IN ('admin', 'owner') AND status='approved'
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

  -- Get user's subscription plan (fallback to 'free')
  BEGIN
    SELECT get_user_plan(effective_user_id) INTO user_plan;
  EXCEPTION WHEN undefined_function THEN
    user_plan := 'free';
  END;

  -- Validate and set duration_days based on plan
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

  -- Create the game
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

-- 2. Create new get_game_overview function with explicit user_id parameter
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
      AND lm.user_id = v_user_profile_id
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

  -- Get leaderboard data (simplified for now)
  SELECT json_agg(
    json_build_object(
      'user_id', pb.user_id,
      'area_km2', 0
    )
  ) INTO leaderboard_data
  FROM public.player_bases pb
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

-- 3. Ensure admin users are automatically members of their own leagues
CREATE OR REPLACE FUNCTION public.ensure_admin_league_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Insert admin as approved member if not already exists
  INSERT INTO public.league_members (league_id, user_id, role, status, joined_at)
  VALUES (NEW.id, NEW.admin_user_id, 'admin', 'approved', NOW())
  ON CONFLICT (league_id, user_id) DO UPDATE SET
    role = 'admin',
    status = 'approved',
    joined_at = NOW();

  RETURN NEW;
END;
$$;

-- Create trigger to ensure admin membership
CREATE TRIGGER ensure_admin_membership_trigger
  AFTER INSERT ON public.leagues
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_admin_league_membership();

-- 4. Grant permissions
REVOKE ALL ON FUNCTION public.create_game FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_game TO authenticated;

REVOKE ALL ON FUNCTION public.get_game_overview FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_game_overview TO authenticated;

REVOKE ALL ON FUNCTION public.ensure_admin_league_membership FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_admin_league_membership TO authenticated;

COMMIT;