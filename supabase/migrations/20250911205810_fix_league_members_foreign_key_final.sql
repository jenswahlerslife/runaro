-- Final fix for league_members foreign key constraint error
-- The issue is that league_members.user_id references auth.users(id) but should reference profiles(id)

-- First, let's check what foreign key constraint exists
DO $$
BEGIN
  -- Drop existing foreign key constraint if it exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'league_members_user_id_fkey'
  ) THEN
    ALTER TABLE public.league_members DROP CONSTRAINT league_members_user_id_fkey;
  END IF;
END $$;

-- Add proper foreign key constraint to profiles table instead of auth.users
ALTER TABLE public.league_members 
ADD CONSTRAINT league_members_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Update the league creation function to use profiles.id instead of auth.uid() directly
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
  v_user_auth_id uuid := auth.uid();
  v_user_profile_id uuid;
  v_league public.leagues;
  v_invite_code text;
BEGIN
  -- Check authentication
  IF v_user_auth_id IS NULL THEN 
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify the user exists in auth.users
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_user_auth_id) THEN
    RAISE EXCEPTION 'User session invalid - user not found in auth.users';
  END IF;

  -- Ensure user has a profile and get the profile ID
  INSERT INTO public.profiles (id, user_id)
  VALUES (v_user_auth_id, v_user_auth_id)
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Get the profile ID (which should be the same as auth user ID)
  SELECT id INTO v_user_profile_id 
  FROM public.profiles 
  WHERE user_id = v_user_auth_id;
  
  IF v_user_profile_id IS NULL THEN
    RAISE EXCEPTION 'Failed to create or find user profile';
  END IF;

  -- Check if user can create league with max members limit
  IF NOT can_create_league(v_user_auth_id, p_max_members) THEN
    RAISE EXCEPTION 'Plan limit exceeded: Free plan allows max 3 members, Pro plan allows max 50 members';
  END IF;

  -- Generate unique invite code
  v_invite_code := substring(md5(random()::text || v_user_auth_id::text || now()::text), 1, 8);

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
    v_user_profile_id,  -- Use profile ID here
    p_is_public, 
    p_max_members, 
    v_invite_code,
    v_user_auth_id      -- Use auth ID for created_by (references auth.users)
  )
  RETURNING * INTO v_league;

  -- Add the creator as owner in league_members table using profile ID
  INSERT INTO public.league_members (league_id, user_id, role, joined_at)
  VALUES (v_league.id, v_user_profile_id, 'owner', now());

  -- Return success response
  RETURN json_build_object(
    'success', true,
    'league_id', v_league.id,
    'invite_code', v_league.invite_code,
    'user_auth_id', v_user_auth_id,
    'user_profile_id', v_user_profile_id
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Return detailed error response for debugging
    RETURN json_build_object(
      'success', false,
      'error', 'Failed to create league: ' || SQLERRM,
      'user_auth_id', v_user_auth_id,
      'user_profile_id', v_user_profile_id,
      'sqlstate', SQLSTATE
    );
END;
$$;

-- Set proper ownership and privileges
ALTER FUNCTION public.create_league_with_owner(text, text, boolean, integer) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.create_league_with_owner(text, text, boolean, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_league_with_owner(text, text, boolean, integer) TO authenticated;

-- Also update leagues table to reference profiles for admin_user_id if needed
DO $$
BEGIN
  -- Check if leagues.admin_user_id references auth.users and change to profiles if needed
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname LIKE '%leagues%admin_user_id%' 
    AND confrelid = 'auth.users'::regclass
  ) THEN
    -- Find the exact constraint name and drop it
    DECLARE
      constraint_name text;
    BEGIN
      SELECT conname INTO constraint_name
      FROM pg_constraint 
      WHERE conrelid = 'public.leagues'::regclass 
      AND conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'public.leagues'::regclass AND attname = 'admin_user_id')];
      
      IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.leagues DROP CONSTRAINT ' || constraint_name;
        ALTER TABLE public.leagues 
        ADD CONSTRAINT leagues_admin_user_id_fkey 
        FOREIGN KEY (admin_user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
      END IF;
    END;
  END IF;
END $$;

SELECT 'Fixed league_members foreign key constraint to reference profiles table' as status;