-- Fix RLS to allow members (not just owners) to see their leagues
-- This fixes the issue where "Your leagues" is empty for regular members

-- 1) Ensure users can read their own league memberships
DROP POLICY IF EXISTS league_members_select_self ON public.league_members;
CREATE POLICY league_members_select_self
ON public.league_members FOR SELECT
USING (user_id = auth.uid());

-- 2) Allow users to read leagues they're members of (not just owners)
DROP POLICY IF EXISTS leagues_select_for_members ON public.leagues;
CREATE POLICY leagues_select_for_members  
ON public.leagues FOR SELECT
USING (
  -- User is a member of this league
  EXISTS (
    SELECT 1 FROM public.league_members lm
    WHERE lm.league_id = leagues.id
      AND lm.user_id = auth.uid()
  )
  -- OR league is public (if you have public leagues)
  -- OR visibility = 'public'
);