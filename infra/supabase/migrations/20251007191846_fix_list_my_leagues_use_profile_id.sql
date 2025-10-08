-- FIX: list_my_leagues_with_role must map auth.uid() to profiles.id
--
-- PROBLEM: After changing league_members.user_id to use profiles.id,
-- this function still checks lm.user_id = auth.uid() which will never match
--
-- SOLUTION: Map auth.uid() to profiles.id before querying league_members

CREATE OR REPLACE FUNCTION public.list_my_leagues_with_role()
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  invite_code text,
  created_at timestamptz,
  role text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid;
  v_profile_id uuid;
BEGIN
  -- Get authenticated user
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN;  -- Not authenticated, return empty
  END IF;

  -- Map auth.uid() to profiles.id
  SELECT p.id INTO v_profile_id
  FROM public.profiles p
  WHERE p.user_id = v_uid;

  IF v_profile_id IS NULL THEN
    RETURN;  -- No profile found, return empty
  END IF;

  -- Return leagues where user is a member (using profile.id)
  RETURN QUERY
  SELECT
    l.id,
    l.name,
    l.description,
    l.invite_code,
    l.created_at,
    lm.role
  FROM public.leagues l
  JOIN public.league_members lm
    ON lm.league_id = l.id
   AND lm.user_id = v_profile_id  -- Now uses profiles.id
  WHERE lm.status = 'approved'
     OR lm.role = 'owner'  -- Owners always see their leagues regardless of status
  ORDER BY l.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.list_my_leagues_with_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_my_leagues_with_role() TO authenticated;

COMMENT ON FUNCTION public.list_my_leagues_with_role() IS
'Lists leagues for authenticated user with their role. Maps auth.uid() to profiles.id for consistency with league_members table.';
