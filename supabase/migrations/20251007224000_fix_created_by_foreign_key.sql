-- Fix created_by foreign key constraint issue
-- Problem: created_by column references auth.users, but function was setting it to profiles.id
-- Solution: Use auth.uid() for created_by, and profiles.id for admin_user_id

DROP FUNCTION IF EXISTS public.create_league_with_owner(text, text, boolean, integer);

CREATE OR REPLACE FUNCTION public.create_league_with_owner(
  p_name text,
  p_description text DEFAULT NULL,
  p_is_public boolean DEFAULT true,
  p_max_members integer DEFAULT 3
) RETURNS public.leagues
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_auth_id uuid;
  v_user_profile_id uuid;
  v_league public.leagues;
  v_user_is_pro boolean := false;
  v_invite_code text;
  v_attempts integer := 0;
  v_max_attempts integer := 10;
BEGIN
  -- Get auth.uid()
  v_user_auth_id := auth.uid();

  IF v_user_auth_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Map auth.uid() to profiles.id (CRITICAL for proper auth mapping)
  SELECT id INTO v_user_profile_id
  FROM public.profiles
  WHERE user_id = v_user_auth_id;

  IF v_user_profile_id IS NULL THEN
    RAISE EXCEPTION 'Profile not found for authenticated user';
  END IF;

  -- Check if user has pro subscription
  -- For now, default to free plan limits
  -- v_user_is_pro := check_user_subscription(v_user_profile_id);

  -- Enforce subscription limits
  IF NOT v_user_is_pro AND p_max_members > 3 THEN
    RAISE EXCEPTION 'Free plan limited to 3 members. Upgrade to Pro for up to 50 members.';
  END IF;

  IF p_max_members > 50 THEN
    RAISE EXCEPTION 'Maximum 50 members per league';
  END IF;

  -- Generate unique invite code with retry logic
  LOOP
    v_attempts := v_attempts + 1;
    v_invite_code := substring(md5(random()::text || clock_timestamp()::text), 1, 8);

    -- Check if code already exists
    IF NOT EXISTS (SELECT 1 FROM public.leagues WHERE invite_code = v_invite_code) THEN
      EXIT; -- Found a unique code
    END IF;

    IF v_attempts >= v_max_attempts THEN
      RAISE EXCEPTION 'Failed to generate unique invite code after % attempts', v_max_attempts;
    END IF;
  END LOOP;

  -- Create the league with proper foreign key references:
  -- - admin_user_id references profiles(id) - use v_user_profile_id
  -- - created_by references auth.users(id) - use v_user_auth_id
  INSERT INTO public.leagues (
    name,
    description,
    is_public,
    max_members,
    admin_user_id,
    created_by,
    invite_code
  )
  VALUES (
    p_name,
    p_description,
    p_is_public,
    p_max_members,
    v_user_profile_id,
    v_user_auth_id,  -- Fixed: use auth.uid() for created_by
    v_invite_code
  )
  RETURNING * INTO v_league;

  -- Add the creator as owner in league_members table
  -- Use ON CONFLICT to handle any edge case duplicates
  INSERT INTO public.league_members (league_id, user_id, role, status)
  VALUES (v_league.id, v_user_profile_id, 'owner', 'approved')
  ON CONFLICT (league_id, user_id) DO NOTHING;

  RETURN v_league;
END;
$$;

-- Grant permissions
REVOKE ALL ON FUNCTION public.create_league_with_owner(text, text, boolean, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_league_with_owner(text, text, boolean, integer) TO authenticated;

COMMENT ON FUNCTION public.create_league_with_owner(text, text, boolean, integer) IS
'Creates a new league with the caller as owner. Uses auth.uid() for created_by (references auth.users) and profiles.id for admin_user_id (references profiles).';

SELECT 'Fixed created_by foreign key constraint in create_league_with_owner' as status;
