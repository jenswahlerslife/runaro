-- Fix foreign key constraint error in league creation
-- 1. First check if created_by column exists, add if needed
-- 2. Fix the RPC function to be more robust
-- 3. Ensure proper FK constraints

-- Add created_by column if it doesn't exist
ALTER TABLE public.leagues 
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

-- Create atomic league creation function that cannot fail on FK constraints
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

  -- Verify the user exists in auth.users (critical check)
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_user) THEN
    RAISE EXCEPTION 'User session invalid - user not found in auth.users';
  END IF;

  -- Ensure user has a profile (insert only if not exists)
  INSERT INTO public.profiles (id, user_id)
  VALUES (v_user, v_user)
  ON CONFLICT (user_id) DO NOTHING;

  -- Generate unique invite code
  v_invite_code := substring(md5(random()::text || v_user::text || now()::text), 1, 8);

  -- Create the league with all required fields
  INSERT INTO public.leagues (
    name, 
    description, 
    admin_user_id, 
    is_public, 
    max_members, 
    invite_code,
    created_by
  )
  VALUES (
    p_name, 
    p_description, 
    v_user, 
    p_is_public, 
    p_max_members, 
    v_invite_code,
    v_user
  )
  RETURNING * INTO v_league;

  -- Check if user can create league with max members limit
  IF NOT can_create_league(v_user, p_max_members) THEN
    RAISE EXCEPTION 'Plan limit exceeded: Free plan allows max 3 members, Pro plan allows max 50 members';
  END IF;

  -- Add the creator as owner in league_members table
  -- This should now work because we verified v_user exists in auth.users
  INSERT INTO public.league_members (league_id, user_id, role, joined_at)
  VALUES (v_league.id, v_user, 'owner', now());

  -- Return success response
  RETURN json_build_object(
    'success', true,
    'league_id', v_league.id,
    'invite_code', v_league.invite_code,
    'user_id', v_user
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Return detailed error response for debugging
    RETURN json_build_object(
      'success', false,
      'error', 'Failed to create league: ' || SQLERRM,
      'user_id', v_user,
      'sqlstate', SQLSTATE
    );
END;
$$;

-- Set proper ownership and privileges
ALTER FUNCTION public.create_league_with_owner(text, text, boolean, integer) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.create_league_with_owner(text, text, boolean, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_league_with_owner(text, text, boolean, integer) TO authenticated;

-- Verify league_members has proper FK constraint to auth.users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'league_members_user_id_fkey'
  ) THEN
    ALTER TABLE public.league_members 
    ADD CONSTRAINT league_members_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

SELECT 'Fixed foreign key constraint issues in league creation' as status;