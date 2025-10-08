-- Drop any existing versions of the function to start clean
DROP FUNCTION IF EXISTS public.create_league_with_owner(text, text, boolean, integer);
DROP FUNCTION IF EXISTS public.create_league_with_owner(text, text);
DROP FUNCTION IF EXISTS public.create_league_with_owner(text);

-- Create the RPC function exactly as specified
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
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Create the league with invite code
  INSERT INTO public.leagues (name, description, admin_user_id, created_by, invite_code)
  VALUES (p_name, p_description, v_user, v_user, substring(md5(random()::text), 1, 8))
  RETURNING * INTO v_league;

  -- Create owner membership
  INSERT INTO public.league_members (league_id, user_id, role)
  VALUES (v_league.id, v_user, 'owner');

  RETURN v_league;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.create_league_with_owner(text, text) TO authenticated;

SELECT 'Created create_league_with_owner RPC function' as status;