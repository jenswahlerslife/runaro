-- Fix create_league_with_owner to use profiles.id for created_by
-- The leagues.created_by column references public.profiles(id). The previous
-- function version inserted auth.uid(), which violates the foreign key when
-- profile IDs differ from auth IDs. This migration remaps the insert to use the
-- caller's profile id while still requiring authentication.

DROP FUNCTION IF EXISTS public.create_league_with_owner(text, text, boolean, integer);

CREATE FUNCTION public.create_league_with_owner(
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
  v_user_is_pro boolean := false;
  v_invite_code text;
  v_attempts integer := 0;
  v_max_attempts integer := 10;
  v_league public.leagues;
BEGIN
  v_user_auth_id := auth.uid();

  IF v_user_auth_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id INTO v_user_profile_id
  FROM public.profiles
  WHERE user_id = v_user_auth_id;

  IF v_user_profile_id IS NULL THEN
    RAISE EXCEPTION 'Profile not found for authenticated user';
  END IF;

  IF NOT v_user_is_pro AND p_max_members > 3 THEN
    RAISE EXCEPTION 'Free plan limited to 3 members. Upgrade to Pro for up to 50 members.';
  END IF;

  IF p_max_members > 50 THEN
    RAISE EXCEPTION 'Maximum 50 members per league';
  END IF;

  LOOP
    v_attempts := v_attempts + 1;
    v_invite_code := substring(md5(random()::text || clock_timestamp()::text), 1, 8);

    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.leagues WHERE invite_code = v_invite_code
    );

    IF v_attempts >= v_max_attempts THEN
      RAISE EXCEPTION 'Failed to generate unique invite code after % attempts', v_max_attempts;
    END IF;
  END LOOP;

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
    v_user_profile_id, -- created_by references profiles.id
    v_invite_code
  )
  RETURNING * INTO v_league;

  INSERT INTO public.league_members (league_id, user_id, role, status)
  VALUES (v_league.id, v_user_profile_id, 'owner', 'approved')
  ON CONFLICT (league_id, user_id) DO NOTHING;

  RETURN v_league;
END;
$$;

REVOKE ALL ON FUNCTION public.create_league_with_owner(text, text, boolean, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_league_with_owner(text, text, boolean, integer) TO authenticated;

COMMENT ON FUNCTION public.create_league_with_owner(text, text, boolean, integer) IS
  'Creates a league using the caller''s profile id for both admin_user_id and created_by (profiles foreign key).';
