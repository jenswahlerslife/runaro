-- Fix RLS policies for games table - IMMEDIATE FIX
-- This allows league members to see games in their leagues

-- Ensure RLS is enabled (may already be done)
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policies to ensure they work
DROP POLICY IF EXISTS "league_members_can_view_games" ON public.games;
DROP POLICY IF EXISTS "league_members_can_read_games" ON public.games;

-- Use league_members view (which should exist) instead of league_memberships
CREATE POLICY "league_members_can_read_games"
ON public.games
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.league_members lm
    WHERE lm.league_id = games.league_id
      AND lm.user_id = auth.uid()
  )
);

-- Allow league owners/admins to create games
DROP POLICY IF EXISTS "league_admins_can_create_games" ON public.games;
DROP POLICY IF EXISTS "league_admins_can_insert_games" ON public.games;

CREATE POLICY "league_admins_can_insert_games"
ON public.games
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.league_members lm
    WHERE lm.league_id = games.league_id
      AND lm.user_id = auth.uid()
      AND lm.role IN ('owner', 'admin')
  )
);
