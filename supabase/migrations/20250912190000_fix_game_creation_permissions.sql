-- Fix game creation permissions to allow both league owner and admins

-- 1. Fix RLS policy for games INSERT
DROP POLICY IF EXISTS "League admins can create games" ON public.games;

CREATE POLICY "League admins can create games"
ON public.games FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL AND (
    -- League owner can create games
    league_id IN (
      SELECT id FROM public.leagues
      WHERE admin_user_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    )
    -- OR user with admin role in league can create games
    OR league_id IN (
      SELECT lm.league_id FROM public.league_members lm
      JOIN public.profiles p ON p.id = lm.user_id
      WHERE p.user_id = auth.uid() AND lm.role = 'admin' AND lm.status = 'approved'
    )
  )
);

-- 2. Fix create_game RPC function to allow both owner and admin
CREATE OR REPLACE FUNCTION public.create_game(
  p_league_id uuid,
  p_name text
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
BEGIN
  -- Get user's profile ID
  SELECT id INTO user_profile_id
  FROM public.profiles 
  WHERE user_id = auth.uid();

  IF user_profile_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'User profile not found'
    );
  END IF;

  -- Check if user is league owner
  IF EXISTS (
    SELECT 1 FROM public.leagues
    WHERE id = p_league_id AND admin_user_id = user_profile_id
  ) THEN
    is_authorized := true;
  END IF;

  -- Check if user has admin role in the league
  IF NOT is_authorized AND EXISTS (
    SELECT 1 FROM public.league_members
    WHERE league_id = p_league_id 
      AND user_id = user_profile_id 
      AND role = 'admin' 
      AND status = 'approved'
  ) THEN
    is_authorized := true;
  END IF;

  -- If still not authorized, reject
  IF NOT is_authorized THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Not authorized to create games in this league'
    );
  END IF;

  -- Check if league has at least 2 approved members
  SELECT COUNT(*) INTO member_count
  FROM public.league_members
  WHERE league_id = p_league_id AND status = 'approved';

  IF member_count < 2 THEN
    RETURN json_build_object(
      'success', false,
      'error', 'League needs at least 2 approved members to create a game'
    );
  END IF;

  -- Create the game
  INSERT INTO public.games (league_id, name, created_by)
  VALUES (p_league_id, p_name, user_profile_id)
  RETURNING * INTO game_record;

  RETURN json_build_object(
    'success', true,
    'game_id', game_record.id,
    'game_name', game_record.name,
    'member_count', member_count
  );
END;
$$;

-- Grant permissions
REVOKE ALL ON FUNCTION public.create_game(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_game(uuid, text) TO authenticated;