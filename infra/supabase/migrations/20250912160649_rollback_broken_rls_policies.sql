-- Emergency rollback: Remove the RLS policy causing infinite recursion
-- The leagues_select_for_members policy is causing 500 errors due to recursive EXISTS check

-- Remove the problematic policy that's causing infinite recursion
DROP POLICY IF EXISTS leagues_select_for_members ON public.leagues;

-- Keep the league_members policy as it's safe and needed
-- CREATE POLICY league_members_select_self ON public.league_members FOR SELECT USING (user_id = auth.uid());

-- For now, let's use a simpler approach - make leagues readable by all authenticated users
-- This is temporary until we can implement a safer member-specific policy
CREATE POLICY leagues_select_authenticated
ON public.leagues FOR SELECT  
TO authenticated
USING (true);