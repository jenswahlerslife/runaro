-- Fix function overload conflict - drop old version and keep atomic version
-- Drop the old complex version that has 4 parameters
DROP FUNCTION IF EXISTS public.create_league_with_owner(text, text, boolean, integer);

-- Ensure we only have the simple atomic version
DROP FUNCTION IF EXISTS public.create_league_with_owner(text, text);

-- Recreate the simple atomic version
CREATE OR REPLACE FUNCTION public.create_league_with_owner(
  p_name text,
  p_description text DEFAULT NULL
) RETURNS public.leagues
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_league public.leagues;
BEGIN
  -- Check authentication
  IF v_user IS NULL THEN 
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Create the league
  INSERT INTO public.leagues (name, description, created_by, admin_user_id, invite_code)
  VALUES (
    p_name, 
    p_description, 
    v_user,
    v_user,
    substring(md5(random()::text), 1, 8)
  )
  RETURNING * INTO v_league;

  -- Add the creator as owner in league_members table
  INSERT INTO public.league_members (league_id, user_id, role)
  VALUES (v_league.id, v_user, 'owner');

  RETURN v_league;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.create_league_with_owner(text, text) TO authenticated;

SELECT 'Fixed function overload conflict - only atomic version remains' as status;