-- Final Game Setup Fix
-- 2025-09-16: Use correct table (league_members, not league_memberships)

SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '10s';
SET LOCAL idle_in_transaction_session_timeout = '20s';

-- Fix create_game function to use the CORRECT table: league_members (which has status column)
DROP FUNCTION IF EXISTS public.create_game(uuid, text, integer);
DROP FUNCTION IF EXISTS public.create_game(uuid, text);

-- Create corrected create_game function using league_members table
CREATE OR REPLACE FUNCTION public.create_game(
  p_league_id uuid,
  p_name text,
  p_duration_days integer DEFAULT NULL
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
BEGIN
  -- Get user profile ID from auth.uid()
  SELECT id INTO user_profile_id
  FROM public.profiles
  WHERE user_id = auth.uid();

  IF user_profile_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User profile not found');
  END IF;

  -- Check if user is league owner OR admin (CORRECTED: use league_members table)
  IF EXISTS (SELECT 1 FROM public.leagues WHERE id = p_league_id AND admin_user_id = user_profile_id)
     OR EXISTS (
       SELECT 1 FROM public.league_members
       WHERE league_id = p_league_id AND user_id = user_profile_id AND role = 'admin' AND status='approved'
     )
  THEN
     is_authorized := true;
  END IF;

  IF NOT is_authorized THEN
    RETURN json_build_object('success', false, 'error', 'Not authorized to create games in this league');
  END IF;

  -- Check approved member count (CORRECTED: use league_members table)
  SELECT COUNT(*) INTO member_count
  FROM public.league_members
  WHERE league_id = p_league_id AND status='approved';

  IF member_count < 2 THEN
    RETURN json_build_object('success', false, 'error', 'League needs at least 2 approved members to create a game');
  END IF;

  -- Get user's subscription plan (fallback to 'free' if function doesn't exist)
  BEGIN
    SELECT get_user_plan(auth.uid()) INTO user_plan;
  EXCEPTION WHEN undefined_function THEN
    user_plan := 'free';
  END;

  -- Validate and set duration_days based on plan
  IF user_plan = 'free' OR user_plan IS NULL THEN
    -- Free plan: force to 14 days, ignore client input
    final_duration_days := 14;
  ELSIF user_plan = 'pro' THEN
    -- Pro plan: validate range 14-30 days
    IF p_duration_days IS NULL THEN
      final_duration_days := 14; -- default
    ELSIF p_duration_days < 14 OR p_duration_days > 30 THEN
      RETURN json_build_object(
        'success', false,
        'error', 'For Pro plans, duration_days must be between 14 and 30 days'
      );
    ELSE
      final_duration_days := p_duration_days;
    END IF;
  ELSE
    -- Fallback: treat as free plan
    final_duration_days := 14;
  END IF;

  -- Create the game with duration_days and immediate start_date
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

-- Create backward compatibility function
CREATE OR REPLACE FUNCTION public.create_game(
  p_league_id uuid,
  p_name text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Call the enhanced version with NULL duration_days (will use plan defaults)
  RETURN public.create_game(p_league_id, p_name, NULL);
END;
$$;

-- Set proper permissions
REVOKE ALL ON FUNCTION public.create_game(uuid, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_game(uuid, text, integer) TO authenticated;

REVOKE ALL ON FUNCTION public.create_game(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_game(uuid, text) TO authenticated;

-- Fix existing setup games by adding missing start_date and duration_days
UPDATE public.games
SET
  start_date = COALESCE(start_date, created_at),
  duration_days = COALESCE(duration_days, 14)
WHERE status = 'setup'
  AND (start_date IS NULL OR duration_days IS NULL);

COMMENT ON FUNCTION public.create_game(uuid, text, integer) IS 'Fixed create_game using correct league_members table with status column';

-- Verification
DO $$
DECLARE
  setup_games_count integer;
  games_with_data_count integer;
BEGIN
  -- Count setup games
  SELECT COUNT(*) INTO setup_games_count
  FROM public.games
  WHERE status = 'setup';

  -- Count games with proper data
  SELECT COUNT(*) INTO games_with_data_count
  FROM public.games
  WHERE status = 'setup' AND start_date IS NOT NULL AND duration_days IS NOT NULL;

  RAISE NOTICE 'SETUP GAMES: % total, % with proper data', setup_games_count, games_with_data_count;

  IF setup_games_count = games_with_data_count THEN
    RAISE NOTICE 'SUCCESS: All setup games now have start_date and duration_days';
  ELSE
    RAISE WARNING 'ISSUE: Some setup games still missing data';
  END IF;
END;
$$;