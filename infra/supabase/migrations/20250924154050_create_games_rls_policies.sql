-- Enable RLS and create policies for games table
-- This fixes the issue where games are not visible to league members

-- Enable RLS on games table
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;

-- Policy: League members can view games in their leagues
CREATE POLICY "league_members_can_view_games"
ON public.games
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.league_memberships lm
    WHERE lm.league_id = games.league_id
      AND lm.user_id = auth.uid()
  )
);

-- Policy: League owners/admins can create games
CREATE POLICY "league_admins_can_create_games"
ON public.games
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.league_memberships lm
    WHERE lm.league_id = games.league_id
      AND lm.user_id = auth.uid()
      AND lm.role IN ('owner', 'admin')
  )
);

-- Policy: League owners/admins can update games in their leagues
CREATE POLICY "league_admins_can_update_games"
ON public.games
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.league_memberships lm
    WHERE lm.league_id = games.league_id
      AND lm.user_id = auth.uid()
      AND lm.role IN ('owner', 'admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.league_memberships lm
    WHERE lm.league_id = games.league_id
      AND lm.user_id = auth.uid()
      AND lm.role IN ('owner', 'admin')
  )
);

-- Policy: League owners/admins can delete games in their leagues
CREATE POLICY "league_admins_can_delete_games"
ON public.games
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.league_memberships lm
    WHERE lm.league_id = games.league_id
      AND lm.user_id = auth.uid()
      AND lm.role IN ('owner', 'admin')
  )
);

COMMENT ON POLICY "league_members_can_view_games" ON public.games IS 'Allow league members to view games in leagues they belong to';
COMMENT ON POLICY "league_admins_can_create_games" ON public.games IS 'Allow league owners and admins to create games';