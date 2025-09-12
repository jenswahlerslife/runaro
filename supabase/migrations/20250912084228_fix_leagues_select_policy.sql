-- Fix overly restrictive RLS policies that cause 500 errors

-- 1) Fix leagues SELECT policy to be more permissive for legitimate reads
DROP POLICY IF EXISTS "leagues_select" ON public.leagues;

-- Allow authenticated users to see:
-- - All public leagues (for directory/discovery)
-- - Leagues they own/admin
-- - Leagues they are members of
CREATE POLICY "leagues_select"
ON public.leagues
FOR SELECT
TO authenticated
USING (
  -- Allow all public leagues to be visible for discovery
  is_public = true
  -- Allow owners/admins to see their leagues
  OR admin_user_id = auth.uid()
  -- Allow members to see leagues they belong to (but avoid recursion)
  OR id IN (
    SELECT DISTINCT league_id 
    FROM public.league_members 
    WHERE user_id = auth.uid()
  )
);

-- 2) Also make sure league_members policy is not causing issues
DROP POLICY IF EXISTS "lm_select" ON public.league_members;

-- More permissive league_members policy:
-- - Users can see their own memberships
-- - League owners can see all members in their leagues
-- - Members can see other members in the same league (for the members page)
CREATE POLICY "lm_select"
ON public.league_members
FOR SELECT
TO authenticated
USING (
  -- User can see their own memberships
  user_id = auth.uid()
  -- OR league owner can see all members in their leagues
  OR EXISTS (
    SELECT 1 FROM public.leagues l
    WHERE l.id = league_members.league_id
      AND l.admin_user_id = auth.uid()
  )
  -- OR members can see other members in same league (needed for members page)
  OR EXISTS (
    SELECT 1 FROM public.league_members lm
    WHERE lm.league_id = league_members.league_id
      AND lm.user_id = auth.uid()
  )
);

-- 3) Ensure join requests policy is not too restrictive
DROP POLICY IF EXISTS "admins_can_read_requests_in_their_league" ON public.league_join_requests;

CREATE POLICY "admins_can_read_requests_in_their_league"
ON public.league_join_requests
FOR SELECT
TO authenticated
USING (
  -- League owners can see requests for their leagues
  EXISTS (
    SELECT 1 FROM public.leagues l
    WHERE l.id = league_join_requests.league_id
      AND l.admin_user_id = auth.uid()
  )
  -- OR admins can see requests (if we implement admin role later)
  OR EXISTS (
    SELECT 1 FROM public.league_members lm
    WHERE lm.league_id = league_join_requests.league_id
      AND lm.user_id = auth.uid()
      AND lm.role IN ('owner', 'admin')
  )
  -- OR users can see their own requests
  OR user_id = auth.uid()
);