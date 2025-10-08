-- FIX: Games RLS Policies with Correct Table and Auth Mapping
-- Timestamp: 20260101000007 (runs AFTER rollup)
--
-- FIXES:
-- 1. Wrong table name: league_memberships → league_members
-- 2. Wrong auth check: lm.user_id = auth.uid() → must map through profiles
--
-- CANONICAL RULE: Join league_members → profiles → auth.uid()

-- Drop all existing policies
DROP POLICY IF EXISTS "league_members_can_view_games" ON public.games;
DROP POLICY IF EXISTS "league_admins_can_create_games" ON public.games;
DROP POLICY IF EXISTS "league_admins_can_update_games" ON public.games;
DROP POLICY IF EXISTS "league_admins_can_delete_games" ON public.games;

-- Ensure RLS is enabled
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- SELECT Policy: League members can view games
-- =============================================================================
CREATE POLICY "league_members_can_view_games"
ON public.games
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.league_members lm
    JOIN public.profiles p ON lm.user_id = p.id
    WHERE lm.league_id = games.league_id
      AND p.user_id = auth.uid()
      AND lm.status = 'approved'
  )
);

-- =============================================================================
-- INSERT Policy: League admins can create games
-- =============================================================================
CREATE POLICY "league_admins_can_create_games"
ON public.games
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.league_members lm
    JOIN public.profiles p ON lm.user_id = p.id
    WHERE lm.league_id = games.league_id
      AND p.user_id = auth.uid()
      AND lm.role IN ('owner', 'admin')
      AND lm.status = 'approved'
  )
);

-- =============================================================================
-- UPDATE Policy: League admins can update games
-- =============================================================================
CREATE POLICY "league_admins_can_update_games"
ON public.games
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.league_members lm
    JOIN public.profiles p ON lm.user_id = p.id
    WHERE lm.league_id = games.league_id
      AND p.user_id = auth.uid()
      AND lm.role IN ('owner', 'admin')
      AND lm.status = 'approved'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.league_members lm
    JOIN public.profiles p ON lm.user_id = p.id
    WHERE lm.league_id = games.league_id
      AND p.user_id = auth.uid()
      AND lm.role IN ('owner', 'admin')
      AND lm.status = 'approved'
  )
);

-- =============================================================================
-- DELETE Policy: League admins can delete games
-- =============================================================================
CREATE POLICY "league_admins_can_delete_games"
ON public.games
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.league_members lm
    JOIN public.profiles p ON lm.user_id = p.id
    WHERE lm.league_id = games.league_id
      AND p.user_id = auth.uid()
      AND lm.role IN ('owner', 'admin')
      AND lm.status = 'approved'
  )
);

-- =============================================================================
-- Comments
-- =============================================================================
COMMENT ON POLICY "league_members_can_view_games" ON public.games IS
  'FIXED: Uses league_members table with profile mapping (lm.user_id = p.id, p.user_id = auth.uid())';

COMMENT ON POLICY "league_admins_can_create_games" ON public.games IS
  'FIXED: Uses league_members table with profile mapping for admin checks';

COMMENT ON POLICY "league_admins_can_update_games" ON public.games IS
  'FIXED: Uses league_members table with profile mapping for admin checks';

COMMENT ON POLICY "league_admins_can_delete_games" ON public.games IS
  'FIXED: Uses league_members table with profile mapping for admin checks';
