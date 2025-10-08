-- Fix 409 conflict in create_league_with_owner
-- Issue: The function may fail if user already has a membership entry
-- Solution: Use ON CONFLICT DO NOTHING for membership insertion

-- Drop existing function
DROP FUNCTION IF EXISTS public.create_league_with_owner(text, text, boolean, integer);

-- Recreate with conflict handling
CREATE OR REPLACE FUNCTION public.create_league_with_owner(
  p_name text,
  p_description text DEFAULT NULL,
  p_is_public boolean DEFAULT true,
  p_max_members integer DEFAULT 3
) RETURNS public.leagues
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_auth_id uuid;
  v_user_profile_id uuid;
  v_league public.leagues;
  v_user_is_pro boolean := false;
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

  -- Create the league (uses profiles.id for admin_user_id)
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
    v_user_profile_id,
    substring(md5(random()::text), 1, 8)
  )
  RETURNING * INTO v_league;

  -- Add the creator as owner in league_members table
  -- Use ON CONFLICT to handle duplicate membership attempts gracefully
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
'Creates a new league with the caller as owner. Uses proper auth.uid() → profiles.id mapping and handles duplicate membership conflicts gracefully.';

SELECT 'Fixed create_league_with_owner to handle 409 conflicts' as status;
