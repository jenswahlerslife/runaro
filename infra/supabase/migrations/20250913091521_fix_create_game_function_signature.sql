-- Fix create_game function signature and ensure it exists correctly
-- The previous migration detected the function has wrong signature

-- First, drop any existing create_game functions to avoid conflicts
DROP FUNCTION IF EXISTS public.create_game(uuid, text, integer);
DROP FUNCTION IF EXISTS public.create_game(text, text, boolean, integer);
DROP FUNCTION IF EXISTS public.create_game(uuid, text);

-- Create the correct create_game function with proper signature (uuid, text)
CREATE FUNCTION public.create_game(p_league_id uuid, p_name text)
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

  -- Check approved member count (this is the key check)
  SELECT COUNT(*) INTO member_count
  FROM public.league_members
  WHERE league_id = p_league_id AND status='approved';

  IF member_count < 2 THEN
    RETURN json_build_object('success', false, 'error', 'League needs at least 2 approved members to create a game');
  END IF;

  -- Create the game
  INSERT INTO public.games (league_id, name, status, created_by)
  VALUES (p_league_id, p_name, 'setup', user_profile_id)
  RETURNING * INTO game_record;

  RETURN json_build_object(
    'success', true, 
    'game_id', game_record.id, 
    'game_name', game_record.name, 
    'member_count', member_count
  );
END;
$$;

-- Ensure proper permissions
REVOKE ALL ON FUNCTION public.create_game(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_game(uuid, text) TO authenticated;

-- Verify the function was created correctly
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'create_game' 
        AND proargtypes::regtype[] = ARRAY['uuid','text']::regtype[]
        AND prosecdef = true  -- SECURITY DEFINER
    ) THEN
        RAISE NOTICE 'SUCCESS: create_game(uuid, text) function created correctly';
    ELSE
        RAISE NOTICE 'ERROR: create_game function creation failed';
    END IF;
END $$;

SELECT 'create_game function signature fixed' as status;