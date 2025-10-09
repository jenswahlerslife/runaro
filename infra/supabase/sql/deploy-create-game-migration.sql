-- MANUAL MIGRATION DEPLOYMENT
-- Enhanced create_game function to support duration_days with Free/Pro plan validation
-- 2025-09-15

SET LOCAL statement_timeout = '15s';
SET LOCAL lock_timeout = '3s';
SET LOCAL idle_in_transaction_session_timeout = '10s';

-- First, drop the existing create_game function
DROP FUNCTION IF EXISTS public.create_game(uuid, text);

-- Create enhanced create_game function with duration_days support
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

  -- Check if user is league owner OR admin
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

  -- Check approved member count
  SELECT COUNT(*) INTO member_count
  FROM public.league_members
  WHERE league_id = p_league_id AND status='approved';

  IF member_count < 2 THEN
    RETURN json_build_object('success', false, 'error', 'League needs at least 2 approved members to create a game');
  END IF;

  -- Get user's subscription plan
  SELECT get_user_plan(auth.uid()) INTO user_plan;

  -- Validate and set duration_days based on plan
  IF user_plan = 'free' THEN
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

  -- Create the game with duration_days
  INSERT INTO public.games (league_id, name, status, created_by, duration_days)
  VALUES (p_league_id, p_name, 'setup', user_profile_id, final_duration_days)
  RETURNING * INTO game_record;

  RETURN json_build_object(
    'success', true,
    'game_id', game_record.id,
    'game_name', game_record.name,
    'duration_days', game_record.duration_days,
    'status', game_record.status,
    'user_plan', user_plan,
    'member_count', member_count
  );
END;
$$;

-- Set proper permissions
REVOKE ALL ON FUNCTION public.create_game(uuid, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_game(uuid, text, integer) TO authenticated;

-- Also create backward compatibility function without duration_days parameter
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

-- Set permissions for backward compatibility function
REVOKE ALL ON FUNCTION public.create_game(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_game(uuid, text) TO authenticated;

-- Test the function exists
SELECT 'Enhanced create_game function deployed successfully' as status;