-- Create atomic league creation function
-- This ensures the user always becomes owner of leagues they create

CREATE OR REPLACE FUNCTION public.create_league_with_owner(
  p_name text,
  p_description text DEFAULT NULL,
  p_is_public boolean DEFAULT false,
  p_max_members integer DEFAULT 10
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_league public.leagues;
  v_invite_code text;
BEGIN
  -- Check authentication
  IF v_user IS NULL THEN 
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify the user exists in auth.users
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_user) THEN
    RAISE EXCEPTION 'User session invalid - user not found';
  END IF;

  -- Ensure user has a profile
  INSERT INTO public.profiles (id, user_id)
  VALUES (v_user, v_user)
  ON CONFLICT (user_id) DO NOTHING;

  -- Generate invite code
  v_invite_code := substring(md5(random()::text), 1, 8);

  -- Create the league
  INSERT INTO public.leagues (name, description, admin_user_id, is_public, max_members, invite_code, created_by)
  VALUES (p_name, p_description, v_user, p_is_public, p_max_members, v_invite_code, v_user)
  RETURNING * INTO v_league;

  -- Add the creator as owner in league_members table
  INSERT INTO public.league_members (league_id, user_id, role, joined_at)
  VALUES (v_league.id, v_user, 'owner', now());

  -- Return success response
  RETURN json_build_object(
    'success', true,
    'league_id', v_league.id,
    'invite_code', v_league.invite_code
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Return error response
    RETURN json_build_object(
      'success', false,
      'error', 'Failed to create league: ' || SQLERRM
    );
END;
$$;

-- Set proper ownership and privileges
ALTER FUNCTION public.create_league_with_owner(text, text, boolean, integer) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.create_league_with_owner(text, text, boolean, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_league_with_owner(text, text, boolean, integer) TO authenticated;

-- Add RLS policy for users to read their own join requests
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'league_join_requests' 
        AND policyname = 'user can read own requests'
    ) THEN
        CREATE POLICY "user can read own requests"
        ON public.league_join_requests
        FOR SELECT
        USING (auth.uid() = user_id);
    END IF;
END $$;

SELECT 'Atomic league creation function created' as status;